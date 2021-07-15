import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  getConnection,
  Raw,
  Repository
} from 'typeorm';
import { Injectable } from '@nestjs/common';

import {
  ClaimDto,
  InvestOrDisInvestDto,
  UserShares,
  WithdrawDto
} from '../dto/investment';
import { SharedProfit } from '../dto/shared-profit';
import { ClaimBooking } from '../entity/claim-booking';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import { CompanySharedProfitFlow as ComProfitFlow } from '../entity/company-shared-profit-flow';
import { CompanySharedProfitBalance as ComProfitBalance } from '../entity/company-shared-profit-balance';
import { ClaimState } from '../util/state';
import { MathService } from '../util/tool';
import { UtilService } from '../util/service';
import {
  Amount,
  RepositoryService,
  TimeService
} from './base';
import { InjectRepository } from '@nestjs/typeorm';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private static readonly _comId = 1;
  private static readonly _noNeedShareMessage = 'No need to share profit.';

  constructor(
    @InjectRepository(ClaimBooking)
    private readonly _claimBookingRepo: Repository<ClaimBooking>,
    @InjectRepository(UserCashBalance)
    private readonly _userCashBalanceRepo: Repository<UserCashBalance>,
    @InjectRepository(UserCashFlow)
    private readonly _userCashFlowRepo: Repository<UserCashFlow>,
    @InjectRepository(UserSharesBalance)
    private readonly _userSharesBalanceRepo: Repository<UserSharesBalance>,
    @InjectRepository(UserSharesFlow)
    private readonly _userSharesFlowRepo: Repository<UserSharesFlow>,
    @InjectRepository(ComProfitBalance)
    private readonly _comProfitBalanceRepo: Repository<ComProfitBalance>,
    @InjectRepository(ComProfitFlow)
    private readonly _comProfitFlowRepo: Repository<ComProfitFlow>
  ) {
  }

  /**
   * For adding the company profit.
   * @param sharedProfit - It's the money that the company want to store in or take it out.
   * @return - void
   */
  public async addProfit(sharedProfit: SharedProfit): Promise<void> {
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      await this._recordComProfitFlow(sharedProfit);
      const netAddProfit = await InvestmentService._calculateNetAddProfit(sharedProfit);
      await this._refreshComProfitBalance(netAddProfit);
      await sql.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await sql.rollbackTransaction();
    } finally {
      await sql.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Add a record to company_shared_profit_flow table.
   * @param sharedProfit - It's the money that the company want to store in or take it out.
   * @return - void
   */
  private async _recordComProfitFlow(sharedProfit: SharedProfit): Promise<void> {
    await this._comProfitFlowRepo.insert(sharedProfit);
  }

  /**
   * Calculate net added profit.
   * @param sharedProfit - It's the money that the company want to store in or take it out.
   * @return - void
   */
  private static async _calculateNetAddProfit(sharedProfit: SharedProfit): Promise<number> {
    const { income, outcome } = sharedProfit;
    return MathService.minus(income, outcome).toNumber();
  }

  /**
   * Refresh company_shared_profit_balance table.
   * @param netAddProfit - It's a net value about the company needs to share.
   * @return - void
   */
  private async _refreshComProfitBalance(netAddProfit: number): Promise<void> {
    const profitBalance = await this._comProfitBalanceRepo.findOne(InvestmentService._comId);
    const comProfitBalance = await InvestmentService._preRefreshComProfitBalance(netAddProfit, profitBalance);
    await RepositoryService.insertOrUpdate(this._comProfitBalanceRepo, comProfitBalance);
  }

  /**
   * Prepare the payload before insert or update action.
   * @param netProfit The net amount is calculated from API request.
   * @param profitBalance ComProfitBalance entity.
   */
  private static async _preRefreshComProfitBalance(netProfit: number, profitBalance: ComProfitBalance) {
    const comProfitBalance = new ComProfitBalance();
    comProfitBalance.id = InvestmentService._comId;
    comProfitBalance.balance = netProfit;
    if (profitBalance) {
      const { balance } = profitBalance;
      comProfitBalance.balance = MathService.plus(balance, netProfit).toNumber();
    }
    return comProfitBalance;
  }

  /**
   * For user invest.
   * @param investDto It's a DTO object from API request.
   * @return - void
   */
  public async invest(investDto: InvestOrDisInvestDto): Promise<void> {
    const userShares = await InvestmentService._preAddRecordUserSharesFlow(investDto.userId, investDto.amount);
    await this._addRecordToUserSharesFlow(userShares);
  }

  /**
   * For user disinvest.
   * @param disInvestDto It's a DTO object from API request.
   * @return - void
   */
  public async disinvest(disInvestDto: InvestOrDisInvestDto): Promise<void> {
    const { userId, amount } = disInvestDto;
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      const userShares = await InvestmentService._preAddRecordUserSharesFlow(userId, undefined, amount);
      await this._addRecordToUserSharesFlow(userShares);
      await this._checkNetSharePositive(userId);
      await sql.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await sql.rollbackTransaction();
    } finally {
      await sql.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Prepare payload before update user_cash_flow table.
   * @param userId It's the id of the user.
   * @param investAmount It's amount for invest.
   * @param disInvestAmount It's amount for disinvest.
   * @return UserShares It's UserShares entity.
   */
  private static async _preAddRecordUserSharesFlow(userId: string, investAmount?: string, disInvestAmount?: string)
    : Promise<UserShares> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = userId;
    userShares.invest = (investAmount) ? (investAmount) : new BigNumber(0).toString();
    userShares.disinvest = (disInvestAmount) ? (disInvestAmount) : new BigNumber(0).toString();
    return userShares;
  }

  /**
   * Add a record to user_shares_flow table.
   * @param userShares It's how many shares user invests.
   * @return - void
   */
  private async _addRecordToUserSharesFlow(userShares: UserShares): Promise<void> {
    await this._userSharesFlowRepo.insert(userShares);
  }

  /**
   * Need to make sure the net shares of the user is more than 0.
   * @param userId It's the id of the user
   * @return - void
   */
  private async _checkNetSharePositive(userId: string): Promise<void> {
    const userSharesFlowRecords = await this._userSharesFlowRepo.find({ where: { userId } });
    let netShares = new BigNumber(0);
    for (const { invest, disinvest } of userSharesFlowRecords) {
      netShares = netShares.plus(new BigNumber(invest)).minus(disinvest);
    }
    if (netShares.isLessThan(0)) {
      throw new Error('User net shares cannot be less than 0');
    }
  }

  /**
   * For user claim the share profit right.
   * @param claimDto It's a DTO object for user claim from API request.
   * @return - void
   */
  public async claim(claimDto: ClaimDto): Promise<void> {
    const { userId } = claimDto;
    const claimBookingRecords = await this._getClaimBookingRecords(userId);
    InvestmentService._checkClaimRecordNotDuplicated(claimBookingRecords);
    const claimBooking = await InvestmentService._preRefreshClaimBooking(userId);
    await this._refreshClaimBooking(claimBooking);
  }

  /**
   * For user claim the share profit right.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async _getClaimBookingRecords(userId: string) {
    return await this._claimBookingRepo.find({
      where: {
        status: ClaimState.INIT,
        userId
      }
    });
  }

  /**
   * prepare payload before refreshing claim_booking table.
   * @param userId It's a id of the user.
   * @return - void
   */
  private static async _preRefreshClaimBooking(userId: string) {
    const claimBooking = new ClaimBooking();
    claimBooking.id = UtilService.genUniqueId();
    claimBooking.userId = userId;
    return claimBooking;
  }

  /**
   * Refresh claim_booking table.
   * @param claimBooking It's a payload mapping to claim_booking entity.
   * @return - void
   */
  private async _refreshClaimBooking(claimBooking: ClaimBooking) {
    await RepositoryService.insertOrUpdate(this._claimBookingRepo, claimBooking);
  }

  /**
   * Check the record is not duplicated.
   * @param claimBookingRecords It's ClaimBooking entity array data.
   * @return - void
   */
  private static _checkClaimRecordNotDuplicated(claimBookingRecords: ClaimBooking[]): void {
    const nowDate = new Date();
    for (const { createdAt } of claimBookingRecords) {
      const season = TimeService.getSeason(createdAt);
      const seasonDateRange = TimeService.getSeasonDateRange(dayjs(createdAt).toDate());
      const { fromAt, toAt } = seasonDateRange.get(season);
      if (TimeService.isInTimePeriod(nowDate, fromAt, toAt)) {
        throw new Error('Cannot duplicated claim in the same season.');
      }
    }
  }

  /**
   * For user withdraw the money from the company share the profit.
   * @param withdrawDto It's a DTO object from API request.
   * @return - void
   */
  public async withdraw(withdrawDto: WithdrawDto): Promise<void> {
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      const userCashBalance = await this._getUserCashBalance(withdrawDto.userId);
      InvestmentService._checkUserCashBalance(userCashBalance);
      const withdrawData = InvestmentService._preAddRecordToUserCashFlow(withdrawDto);
      const { balance } = userCashBalance;
      const amount = InvestmentService._genAmount(balance, withdrawData.deposit, withdrawData.withdraw);
      await InvestmentService._checkWithdrawAmountLessThanBalance(amount);
      const newUserCashBalance = await this._preUpdateUserCashBalance(withdrawDto.userId, amount);
      await this._updateUserCashBalance(newUserCashBalance, withdrawData);
      await this._addRecordToUserCashFlow(withdrawData);
      await sql.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await sql.rollbackTransaction();
    } finally {
      await sql.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * For user withdraw the money from the company share the profit.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async _getUserCashBalance(userId: string) {
    return await this._userCashBalanceRepo.findOne(userId);
  }

  /**
   * Check the balance in user_cash_balance table.
   * @param userCashBalance It's UserCashBalance entity.
   * @return - void
   */
  private static _checkUserCashBalance(userCashBalance: UserCashBalance): void {
    if (!userCashBalance) {
      throw  new Error('The balance of the user is 0.');
    }
  }

  /**
   * Check the withdraw amount is less than balance amount or not.
   * @param amount It's a instance from Amount class.
   * @return - void
   */
  private static _checkWithdrawAmountLessThanBalance(amount: Amount): void {
    if (amount.isWithdrawAmountLessThanBalance) {
      throw new Error('Withdraw amount must less than balance.');
    }
  }

  /**
   * Prepare the payload for insert or update user_cash_flow table.
   * @param withdrawDto It's a DTO object from API request.
   * @return WithDraw It's WithDraw entity.
   */
  private static _preAddRecordToUserCashFlow(withdrawDto: WithdrawDto): UserCashFlow {
    const withDraw = new UserCashFlow();
    withDraw.id = UtilService.genUniqueId();
    withDraw.userId = withdrawDto.userId;
    withDraw.withdraw = new BigNumber(withdrawDto.amount).toNumber();
    withDraw.deposit = new BigNumber(0).toNumber();
    return withDraw;
  }

  /**
   * Get an instance of Amount class.
   * @param balanceAmount It's a balance amount.
   * @param depositAmount It's a deposit amount.
   * @param withdrawAmount It's a withdraw amount.
   * @return Amount It's an instance of Amount class.
   */
  private static _genAmount(balanceAmount: number, depositAmount: number, withdrawAmount): Amount {
    const amount = new Amount();
    amount.initBalanceAmount = balanceAmount;
    amount.depositAmount = depositAmount;
    amount.withdrawAmount = withdrawAmount;
    return amount;
  }

  /**
   * Update user_cash_balance table.
   * @param userCashBalance It's UserCashBalance entity.
   * @param withDraw It's WithDraw entity.
   * @return - void
   */
  private async _updateUserCashBalance(userCashBalance: UserCashBalance, withDraw: UserCashFlow)
    : Promise<void> {
    await this._userCashBalanceRepo.createQueryBuilder().update(UserCashBalance)
      .set(userCashBalance)
      // To avoid phantom READ,balance - withdraw >= 0
      .where('balance - :withdraw >= 0 AND userId = :userId', {
        withdraw: withDraw.withdraw,
        userId: withDraw.userId
      })
      .execute();
  }

  /**
   * Settle user's investment shares.
   * @param fromAt It's started date about settle.
   * @param toAt It's ended date about settle.
   * @return - void
   */
  public async settleUserShares(fromAt: string, toAt: string): Promise<void> {
    let errorMessage = '';
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    await sql.connect();
    await sql.startTransaction();
    try {
      const userSharesFlowRecords = await this._getUserSharesFlowRecords(fromAt, toAt);
      const { totalShares, userSharesMap } = InvestmentService._calculateUserShares(userSharesFlowRecords);
      const { userIds, updateUserShareRows } = InvestmentService.preUpdateUserShares(totalShares, userSharesMap);
      await InvestmentService._checkUserShares(userIds, updateUserShareRows);
      await this._deleteUserSharesBalance(userIds);
      await this._addRecordsToUserSharesBalance(updateUserShareRows);
      await sql.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await sql.rollbackTransaction();
    } finally {
      await sql.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Get records from user_shares_flow table.
   * @param fromAt It's started date about settle.
   * @param toAt It's ended date about settle.
   * @return - void
   */
  private async _getUserSharesFlowRecords(fromAt: string, toAt: string)
    : Promise<UserSharesFlow[]> {
    const fromAtUnix = dayjs(fromAt).unix();
    const toAtUnix = dayjs(toAt).unix();
    return await this._userSharesFlowRepo.find({
      createdAt: Raw(alias => `unix_timestamp(${alias}) >= ${fromAtUnix} AND unix_timestamp(${alias}) < ${toAtUnix}`)
    });
  }

  /**
   * Calculate user's investment shares.
   * @param userSharesRecords It's records from user_shares_flow table.
   * @return - {totalShares,userSharesMap}
   */
  private static _calculateUserShares(userSharesRecords: UserSharesFlow[])
    : { totalShares: number, userSharesMap: Map<string, BigNumber> } {
    const userSharesMap = new Map<string, BigNumber>();
    let totalShares = new BigNumber(0).toNumber();
    for (const { userId, invest, disinvest } of userSharesRecords) {
      userSharesMap[userId] = userSharesMap[userId] ?? 0;
      const investAmount = new BigNumber(invest);
      const disinvestAmount = new BigNumber(disinvest);
      userSharesMap[userId] = MathService.plus(userSharesMap[userId], investAmount).minus(disinvestAmount);
      totalShares = MathService.plus(totalShares, investAmount).minus(disinvestAmount).toNumber();
    }
    return { totalShares, userSharesMap };
  }

  /**
   * Prepare payload for update user_shares_balance table.
   * @param totalShares It's a total number about the whole shares.
   * @param userSharesMap It's a map that store every user's shares.
   * @return - { userIds, updateUserShareRows }
   */
  private static preUpdateUserShares(totalShares: number, userSharesMap: Map<string, BigNumber>)
    : { userIds: string[], updateUserShareRows: UserSharesBalance[] } {
    const updateUserShareRows = [];
    const userIds = [];
    // Notice: DO NOT use Map.entries() that will return empty array
    for (const [userId, balance] of Object.entries(userSharesMap)) {
      const userSharesBalance = new UserSharesBalance();
      userSharesBalance.userId = userId;
      userSharesBalance.balance = balance.toString();
      userSharesBalance.proportion = InvestmentService._calculateProportion(balance, totalShares);
      userSharesBalance.updatedAt = new Date();
      updateUserShareRows.push(userSharesBalance);
      userIds.push(userId);
    }
    return { userIds, updateUserShareRows };
  }

  /**
   * Calculate investment shares proportion.
   * @param balance It's a balance amount.
   * @param totalShares It's a total shares number.
   * @return - number
   */
  private static _calculateProportion(balance: BigNumber, totalShares: number): number {
    return (balance.toNumber()) ? new BigNumber(balance.dividedBy(totalShares).times(100)).toNumber() : 0;
  }

  /**
   * Check user's invested shares.
   * @param userIds It's a user list.
   * @param updateUserShareRows It's a list that wants to update in user_shares_balance table.
   * @return - void
   */
  private static _checkUserShares(userIds: string[], updateUserShareRows: UserSharesBalance[]): void {
    if (userIds.length === 0 || updateUserShareRows.length === 0) {
      throw new Error(this._noNeedShareMessage);
    }
  }

  /**
   * Delete rows in user_shares_balance table.
   * @param userIds It's a user list.
   * @return - void
   */
  private async _deleteUserSharesBalance(userIds: string[]): Promise<void> {
    // Delete old data
    await this._userSharesBalanceRepo.delete(userIds);
  }

  /**
   * Add records in user_shares_balance table.
   * @param updateUserShareRows It's a list that wants to update in user_shares_balance table.
   * @return - void
   */
  private async _addRecordsToUserSharesBalance(updateUserShareRows: UserSharesBalance[]) {
    await this._userSharesBalanceRepo.insert(updateUserShareRows);
  }

  /**
   * Get qualified claimer list.
   * @return string[] It's qualified claimer list.
   */
  public async getQualifiedClaimers(): Promise<string[]> {
    const claimBookingRecords = await this._claimBookingRepo.find({ status: ClaimState.INIT });
    return await this._getQualifiedClaimers(claimBookingRecords);
  }

  /**
   * Get qualified claimer list.
   * @return string[] It's qualified claimer list.
   */
  private async _getQualifiedClaimers(claimBookingRecords: ClaimBooking[]): Promise<string[]> {
    const shareProfitClaimerIds = [];
    for (const record of claimBookingRecords) {
      const isClaimDateInPeriod = this._isClaimDateAvailable(record.createdAt);
      if (isClaimDateInPeriod && record.status === ClaimState.INIT) {
        shareProfitClaimerIds.push(record.userId);
      }
    }
    return shareProfitClaimerIds;
  }

  /**
   * Set not qualified claimer's status to expired.
   * @return - void
   */
  public async setNotQualifiedClaimersExpired(): Promise<void> {
    const claimBookingRecords = await this._claimBookingRepo.find({ status: ClaimState.INIT });
    await this._setNotQualifiedClaimersExpired(claimBookingRecords);
  }

  /**
   * Set not qualified claimer's status to expired.
   * @return - void
   */
  private async _setNotQualifiedClaimersExpired(claimBookingRecords: ClaimBooking[]): Promise<void> {
    for (const record of claimBookingRecords) {
      const isClaimDateInPeriod = this._isClaimDateAvailable(record.createdAt);
      if (!isClaimDateInPeriod && record.status === ClaimState.INIT) {
        await InvestmentService._setExpiredInClaimBooking(record.id);
      }
    }
  }

  /**
   * Is claim date in the max claimable season?
   * @param createdAt It's a create datetime.
   * @return - boolean
   */
  private _isClaimDateAvailable(createdAt: Date): boolean {
    const currentSeason = TimeService.getSeason();
    const seasonDateRange = TimeService.getSeasonDateRange(new Date());
    const fromAt = seasonDateRange.get(currentSeason).fromAt;
    const maxClaimableMonths = this._maxClaimableSeason * 3;
    const earliestAvailableDate = dayjs(fromAt).subtract(maxClaimableMonths, 'months');
    return earliestAvailableDate.diff(dayjs(createdAt)) <= 0;
  }

  /**
   * Set claimer's status to expired.
   * @param id It's a record id.
   * @return - void
   */
  private static async _setExpiredInClaimBooking(id: string): Promise<void> {
    await getConnection()
      .createQueryBuilder()
      .update(ClaimBooking)
      .set({ status: ClaimState.EXPIRED })
      .where({ id })
      .execute();
  }

  /**
   * Calculate the amount that should pay to the user.
   * @param shareProfitClaimerIds It's a user list that should be paid.
   * @return payableClaimers - It's a list that company needs to pay.
   */
  public async getPayableClaimers(shareProfitClaimerIds: string[]): Promise<Map<string, BigNumber>> {
    const { balance } = await this._comProfitBalanceRepo.findOne(InvestmentService._comId);
    const userSharesBalanceRecords = await this._userSharesBalanceRepo.findByIds(shareProfitClaimerIds);
    const payableClaimers = new Map<string, BigNumber>();
    for (const { userId, proportion } of userSharesBalanceRecords) {
      // proportion is base on 100% expression so needs to be divided by 100 to times balance amount.
      const payableAmount = new BigNumber(proportion).dividedBy(100).times(new BigNumber(balance));
      payableClaimers.set(userId, payableAmount);
    }
    return payableClaimers;
  }

  /**
   * Company do share profit to investor.
   * @param payableClaimers It's a list that company needs to pay.
   * @return - void
   */
  public async shareProfit(payableClaimers: Map<string, BigNumber>): Promise<void> {
    await InvestmentService._checkClaimers(payableClaimers);
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      const totalPayableProfit = InvestmentService._calculateTotalPayableAmount(payableClaimers);
      await InvestmentService._checkIfCompanyNeedPay(totalPayableProfit);
      await this.runUserOperation(payableClaimers);
      await this.runCompOperation(totalPayableProfit);
      await sql.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await sql.rollbackTransaction();
    } finally {
      await sql.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Company do share profit to investor.
   * @param payableClaimers It's a list that company needs to pay.
   * @return - void
   */
  private static _checkClaimers(payableClaimers: Map<string, BigNumber>): void {
    if (payableClaimers.size === 0) {
      throw new Error(this._noNeedShareMessage);
    }
  }

  /**
   * Run user operation.
   * @param payableClaimers It's a list that company needs to pay.
   * @return - void
   */
  private async runUserOperation(payableClaimers: Map<string, BigNumber>): Promise<void> {
    await this._updatePayableUserCashFlow(payableClaimers);
    await this._updatePayableUserCashBalance(payableClaimers);
  }

  /**
   * Run company operation.
   * @param totalPayableProfit It's a sum value about the company total need to pay.
   * @return - void
   */
  private async runCompOperation(totalPayableProfit): Promise<void> {
    const companySharedProfitFlow = InvestmentService._preInsertCompSharedProfitFlow(totalPayableProfit);
    await this._comProfitFlowRepo.insert(companySharedProfitFlow);
    const { outcome } = companySharedProfitFlow;
    const updateProfitBalance = await this._preUpdateCompProfitBalance(InvestmentService._comId, outcome);
    await this._updateCompProfitBalance(updateProfitBalance, outcome);
  }

  /**
   * Calculate total payable amount.
   * @param payableClaimers It's a list that company needs to pay.
   * @return totalNeedShareProfit It's a sum value about the company total need to pay.
   */
  private static _calculateTotalPayableAmount(payableClaimers: Map<string, BigNumber>): BigNumber {
    let totalNeedShareProfit = new BigNumber(0);
    for (const value of payableClaimers.values()) {
      totalNeedShareProfit = MathService.plus(totalNeedShareProfit.toNumber(), value.toNumber());
    }
    return totalNeedShareProfit;
  }

  /**
   * Check if the company need to pay.
   * @param totalPayableProfit It's a sum value about the company total need to pay.
   * @return - void
   */
  private static _checkIfCompanyNeedPay(totalPayableProfit: BigNumber) {
    // check if company needs to share profit
    if (totalPayableProfit.toNumber() <= 0) {
      throw new Error(this._noNeedShareMessage);
    }
  }

  /**
   * Update user's cash flow if the user is available to gain the shared profit.
   * @param profitClaimers It's a list that company needs to pay.
   * @return - void
   */
  private async _updatePayableUserCashFlow(profitClaimers: Map<string, BigNumber>) {
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      await this._allocateFunds(userId, payableAmount.toNumber());
    }
  }

  /**
   * Company distribute the shared profit to user.
   * @param userId It's the id of the user.
   * @param payableAmount It's the amount company needs to pay.
   * @return - void
   */
  private async _allocateFunds(userId, payableAmount: number): Promise<void> {
    const userCashFlow = new UserCashFlow();
    userCashFlow.id = UtilService.genUniqueId();
    userCashFlow.userId = userId;
    userCashFlow.deposit = new BigNumber(payableAmount).toNumber();
    userCashFlow.withdraw = 0;
    await this._addRecordToUserCashFlow(userCashFlow);
  }

  /**
   * Add record th user_cash_flow table.
   * @param userCashFlowRecord It's a payload for adding to user_cash_flow table.
   * @return - void
   */
  private async _addRecordToUserCashFlow(userCashFlowRecord: UserCashFlow) {
    await this._userCashFlowRepo.insert(userCashFlowRecord);
  }

  /**
   * Update the record in user_cash_balance if the user could gain the shared profit.
   * @param profitClaimers It's the amount company needs to pay.
   * @return - void
   */
  private async _updatePayableUserCashBalance(profitClaimers: Map<string, BigNumber>)
    : Promise<void> {
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      const userCashBalance = await this._userCashBalanceRepo.findOne(userId);
      await this.initializeUserCashBalance(userId, userCashBalance);
      const amount = new Amount();
      amount.initBalanceAmount = (userCashBalance) ? userCashBalance.balance : 0;
      amount.depositAmount = payableAmount.toNumber();
      const updateCashBalance = await this._preUpdateUserCashBalance(userId, amount);
      await this._userCashBalanceRepo.update(userId, updateCashBalance);
      await this._setFinishToQualifiedClaimer(userId);
    }
  }

  /**
   * Check user's balance amount in user_cash_balance table.
   * @param userId It's the id of the user.
   * @param balance It's balance amount of the user in user_cash_balance table.
   * @return - void
   */
  private async initializeUserCashBalance(userId: string, balance: UserCashBalance) {
    if (balance) {
      return;
    }
    const userCashBalance = new UserCashBalance();
    userCashBalance.userId = userId;
    userCashBalance.balance = 0;
    await RepositoryService.insertOrUpdate(this._userCashBalanceRepo, userCashBalance);
  }

  /**
   * Prepare the payload before updating the user_cash_balance table.
   * @param userId It's the id of the user.
   * @param amount It's a instance from Amount class.
   * @return UserCashBalance
   */
  private async _preUpdateUserCashBalance(userId: string, amount: Amount)
    : Promise<UserCashBalance> {
    const updateCashBalance = await this._userCashBalanceRepo.findOne(userId);
    updateCashBalance.balance = amount.balanceAmount;
    return updateCashBalance;
  }

  /**
   * Set qualified claimer's status to expired.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async _setFinishToQualifiedClaimer(userId: string): Promise<void> {
    const claimBooking = await this._claimBookingRepo.findOne({
      userId,
      status: ClaimState.INIT
    });
    claimBooking.status = ClaimState.FINISH;
    await this._claimBookingRepo.createQueryBuilder().update(ClaimBooking)
      .set(claimBooking)
      .where('userId = :userId AND status = :claimState', {
        userId,
        claimState: ClaimState.INIT
      })
      .execute();
  }

  /**
   * Prepare the payload before insert a record in the company_shared_profit_flow table.
   * @param totalPayableProfit It's amount of the company needs to pay.
   * @return ComProfitFlow
   */
  private static _preInsertCompSharedProfitFlow(totalPayableProfit: BigNumber): ComProfitFlow {
    const companySharedProfitFlow = new ComProfitFlow();
    companySharedProfitFlow.income = 0;
    companySharedProfitFlow.outcome = totalPayableProfit.toNumber();
    return companySharedProfitFlow;
  }

  /**
   * Prepare the payload before updating a record in the company_shared_profit_flow table.
   * @param companyId It's the id of the company.
   * @param outcome It's amount that company needs to pay.
   * @return ComProfitBalance
   */
  private async _preUpdateCompProfitBalance(companyId: number, outcome: number)
    : Promise<ComProfitBalance> {
    const companyProfitBalance = await this._comProfitBalanceRepo.findOne(companyId);
    const updateBalance = new BigNumber(companyProfitBalance.balance).minus(outcome).toNumber();
    companyProfitBalance.id = companyId;
    companyProfitBalance.balance = updateBalance;
    return companyProfitBalance;
  }

  /**
   * Update company profit balance.
   * @param profitBalance It's a payload that for updating company_shared_profit_balance table
   * @param outcome It's amount that company needs to pay.
   * @return - void
   */
  private async _updateCompProfitBalance(
    profitBalance: ComProfitBalance, outcome: number) {
    await this._comProfitBalanceRepo.createQueryBuilder().update(ComProfitBalance)
      .set(profitBalance)
      // To avoid phantom READ,balance - outcome >= 0
      .where('balance - :outcome >= 0 AND id = :id', {
        outcome,
        id: InvestmentService._comId
      })
      .execute();
  }
}