import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  getConnection,
  getRepository,
  QueryRunner,
  Raw
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
import { CompanySharedProfitFlow as ComProfitFlow } from '../entity/company-shared-profit-flow';
import { CompanySharedProfitBalance as ComProfitBalance } from '../entity/company-shared-profit-balance';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import { ClaimState } from '../util/state';
import { MathService } from '../util/tool';
import { UtilService } from '../util/service';
import {
  Amount,
  RepositoryService,
  TimeService
} from './base';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private static readonly _comId = 1;
  private static readonly _noNeedShareMessage = 'No need to share profit.';

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
      await InvestmentService._recordComProfitFlow(sharedProfit, sql);
      const netAddProfit = await InvestmentService._calculateNetAddProfit(sharedProfit);
      await InvestmentService._refreshComProfitBalance(netAddProfit, sql);
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
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _recordComProfitFlow(sharedProfit: SharedProfit, sql: QueryRunner): Promise<void> {
    await sql.manager.getRepository(ComProfitFlow).insert(sharedProfit);
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
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _refreshComProfitBalance(netAddProfit: number, sql: QueryRunner): Promise<void> {
    const comProfitBalanceRepo = sql.manager.getRepository(ComProfitBalance);
    const profitBalance = await comProfitBalanceRepo.findOne(InvestmentService._comId);
    const comProfitBalance = await InvestmentService._preRefreshComProfitBalance(netAddProfit, profitBalance);
    await RepositoryService.insertOrUpdate(comProfitBalanceRepo, comProfitBalance);
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
    await InvestmentService._addRecordToUserSharesFlow(userShares);
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
      await InvestmentService._addRecordToUserSharesFlow(userShares);
      await InvestmentService._checkNetSharePositive(userId);
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
  private static async _addRecordToUserSharesFlow(userShares: UserShares): Promise<void> {
    const userSharesFlowRepository = getRepository(UserSharesFlow);
    await userSharesFlowRepository.insert(userShares);
  }

  /**
   * Need to make sure the net shares of the user is more than 0.
   * @param userId It's the id of the user
   * @return - void
   */
  private static async _checkNetSharePositive(userId: string): Promise<void> {
    const userSharesRepo = getRepository(UserSharesFlow);
    const userSharesFlowRecords = await userSharesRepo.find({ where: { userId } });
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
    const claimBookingRecords = await InvestmentService._getClaimBookingRecords(userId);
    InvestmentService._checkClaimRecordNotDuplicated(claimBookingRecords);
    const claimBooking = await InvestmentService._preRefreshClaimBooking(userId);
    await InvestmentService._refreshClaimBooking(claimBooking);
  }

  /**
   * For user claim the share profit right.
   * @param userId It's the id of the user.
   * @return - void
   */
  private static async _getClaimBookingRecords(userId: string) {
    const claimBookingRepository = getRepository(ClaimBooking);
    return await claimBookingRepository.find({
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
  private static async _refreshClaimBooking(claimBooking: ClaimBooking) {
    const claimBookingRepository = getRepository(ClaimBooking);
    await RepositoryService.insertOrUpdate(claimBookingRepository, claimBooking);
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
      const userCashBalance = await InvestmentService._getUserCashBalance(withdrawDto.userId, sql);
      InvestmentService._checkUserCashBalance(userCashBalance);
      const withdrawData = InvestmentService._preAddRecordToUserCashFlow(withdrawDto);
      const { balance } = userCashBalance;
      const amount = InvestmentService._genAmount(balance, withdrawData.deposit, withdrawData.withdraw);
      await InvestmentService._checkWithdrawAmountLessThanBalance(amount);
      const newUserCashBalance = await InvestmentService._preUpdateUserCashBalance(withdrawDto.userId, amount, sql);
      await InvestmentService._updateUserCashBalance(newUserCashBalance, withdrawData, sql);
      await InvestmentService._addRecordToUserCashFlow(withdrawData, sql);
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
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _getUserCashBalance(userId: string, sql: QueryRunner) {
    const UserCashBalanceRepository = sql.manager.getRepository(UserCashBalance);
    return await UserCashBalanceRepository.findOne(userId);
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
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _updateUserCashBalance(userCashBalance: UserCashBalance, withDraw: UserCashFlow, sql: QueryRunner)
    : Promise<void> {
    await sql.manager.createQueryBuilder().update(UserCashBalance)
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
      const userSharesFlowRecords = await InvestmentService._getUserSharesFlowRecords(fromAt, toAt, sql);
      const { totalShares, userSharesMap } = InvestmentService._calculateUserShares(userSharesFlowRecords);
      const { userIds, updateUserShareRows } = InvestmentService.preUpdateUserShares(totalShares, userSharesMap);
      await InvestmentService._checkUserShares(userIds, updateUserShareRows);
      await InvestmentService._deleteUserSharesBalance(userIds, sql);
      await InvestmentService._addRecordsToUserSharesBalance(updateUserShareRows, sql);
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
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _getUserSharesFlowRecords(fromAt: string, toAt: string, sql: QueryRunner)
    : Promise<UserSharesFlow[]> {
    const fromAtUnix = dayjs(fromAt).unix();
    const toAtUnix = dayjs(toAt).unix();
    return await sql.manager.getRepository(UserSharesFlow).find({
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
  private static _calculateProportion(balance: BigNumber, totalShares: number):number {
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
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _deleteUserSharesBalance(userIds: string[], sql: QueryRunner): Promise<void> {
    const userSharesBalanceRepository = sql.manager.getRepository(UserSharesBalance);
    // Delete old data
    await userSharesBalanceRepository.delete(userIds);
  }

  /**
   * Add records in user_shares_balance table.
   * @param updateUserShareRows It's a list that wants to update in user_shares_balance table.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _addRecordsToUserSharesBalance(updateUserShareRows: UserSharesBalance[], sql: QueryRunner) {
    const userShareBalanceRepository = sql.manager.getRepository(UserSharesBalance);
    await userShareBalanceRepository.insert(updateUserShareRows);
  }

  /**
   * Get qualified claimer list.
   * @return string[] It's qualified claimer list.
   */
  public async getQualifiedClaimers(): Promise<string[]> {
    const claimBookingRecords = await getRepository(ClaimBooking).find({ status: ClaimState.INIT });
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
    const claimBookingRecords = await getRepository(ClaimBooking).find({ status: ClaimState.INIT });
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
    const CompanyProfitBalanceRepository = getRepository(ComProfitBalance);
    const { balance } = await CompanyProfitBalanceRepository.findOne(InvestmentService._comId);
    const userSharesBalanceRecords = await getRepository(UserSharesBalance).findByIds(shareProfitClaimerIds);
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
      await InvestmentService.runUserOperation(payableClaimers, sql);
      await InvestmentService.runCompOperation(totalPayableProfit, sql);
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
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async runUserOperation(payableClaimers: Map<string, BigNumber>, sql: QueryRunner): Promise<void> {
    await InvestmentService._updatePayableUserCashFlow(payableClaimers, sql);
    await InvestmentService._updatePayableUserCashBalance(payableClaimers, sql);
  }

  /**
   * Run company operation.
   * @param totalPayableProfit It's a sum value about the company total need to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async runCompOperation(totalPayableProfit, sql: QueryRunner): Promise<void> {
    const companySharedProfitFlow = InvestmentService._preInsertCompSharedProfitFlow(totalPayableProfit);
    await sql.manager.getRepository(ComProfitFlow).insert(companySharedProfitFlow);
    const { outcome } = companySharedProfitFlow;
    const updateProfitBalance = await InvestmentService._preUpdateCompProfitBalance(this._comId, outcome, sql);
    await this._updateCompProfitBalance(updateProfitBalance, outcome, sql);
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
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _updatePayableUserCashFlow(profitClaimers: Map<string, BigNumber>, sql: QueryRunner) {
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      await InvestmentService._allocateFunds(userId, payableAmount.toNumber(), sql);
    }
  }

  /**
   * Company distribute the shared profit to user.
   * @param userId It's the id of the user.
   * @param payableAmount It's the amount company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _allocateFunds(userId, payableAmount: number, sql: QueryRunner): Promise<void> {
    const userCashFlow = new UserCashFlow();
    userCashFlow.id = UtilService.genUniqueId();
    userCashFlow.userId = userId;
    userCashFlow.deposit = new BigNumber(payableAmount).toNumber();
    userCashFlow.withdraw = 0;
    await InvestmentService._addRecordToUserCashFlow(userCashFlow, sql);
  }

  /**
   * Add record th user_cash_flow table.
   * @param userCashFlowRecord It's a payload for adding to user_cash_flow table.
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _addRecordToUserCashFlow(userCashFlowRecord: UserCashFlow, sql: QueryRunner) {
    const userCashFlowRepository = sql.manager.getRepository(UserCashFlow);
    await userCashFlowRepository.insert(userCashFlowRecord);
  }

  /**
   * Update the record in user_cash_balance if the user could gain the shared profit.
   * @param profitClaimers It's the amount company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _updatePayableUserCashBalance(profitClaimers: Map<string, BigNumber>, sql: QueryRunner)
    : Promise<void> {
    const userCashBalanceRepository = sql.manager.getRepository(UserCashBalance);
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      const userCashBalance = await sql.manager.getRepository(UserCashBalance).findOne(userId);
      await InvestmentService.initializeUserCashBalance(userId, userCashBalance, sql);
      const amount = new Amount();
      amount.initBalanceAmount = (userCashBalance) ? userCashBalance.balance : 0;
      amount.depositAmount = payableAmount.toNumber();
      const updateCashBalance = await InvestmentService._preUpdateUserCashBalance(userId, amount, sql);
      await userCashBalanceRepository.update(userId, updateCashBalance);
      await this._setFinishToQualifiedClaimer(userId, sql);
    }
  }

  /**
   * Check user's balance amount in user_cash_balance table.
   * @param userId It's the id of the user.
   * @param balance It's balance amount of the user in user_cash_balance table.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async initializeUserCashBalance(userId: string, balance: UserCashBalance, sql: QueryRunner) {
    if (balance) {
      return;
    }
    const userCashBalance = new UserCashBalance();
    userCashBalance.userId = userId;
    userCashBalance.balance = 0;
    const userCashBalanceRepository = await sql.manager.getRepository(UserCashBalance);
    await RepositoryService.insertOrUpdate(userCashBalanceRepository, userCashBalance);
  }

  /**
   * Prepare the payload before updating the user_cash_balance table.
   * @param userId It's the id of the user.
   * @param amount It's a instance from Amount class.
   * @param sql It's TypeORM QueryRunner.
   * @return UserCashBalance
   */
  private static async _preUpdateUserCashBalance(userId: string, amount: Amount, sql: QueryRunner)
    : Promise<UserCashBalance> {
    const updateCashBalance = await sql.manager.getRepository(UserCashBalance).findOne(userId);
    updateCashBalance.balance = amount.balanceAmount;
    return updateCashBalance;
  }

  /**
   * Set qualified claimer's status to expired.
   * @param userId It's the id of the user.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _setFinishToQualifiedClaimer(userId: string, sql: QueryRunner): Promise<void> {
    const claimBookingRepository = sql.manager.getRepository(ClaimBooking);
    const claimBooking = await claimBookingRepository.findOne({
      userId,
      status: ClaimState.INIT
    });
    claimBooking.status = ClaimState.FINISH;
    await sql.manager.createQueryBuilder().update(ClaimBooking)
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
   * @param sql It's TypeORM QueryRunner.
   * @return ComProfitBalance
   */
  private static async _preUpdateCompProfitBalance(companyId: number, outcome: number, sql: QueryRunner)
    : Promise<ComProfitBalance> {
    const companyProfitBalance = await sql.manager.getRepository(ComProfitBalance).findOne(companyId);
    const updateBalance = new BigNumber(companyProfitBalance.balance).minus(outcome).toNumber();
    companyProfitBalance.id = companyId;
    companyProfitBalance.balance = updateBalance;
    return companyProfitBalance;
  }

  /**
   * Update company profit balance.
   * @param profitBalance It's a payload that for updating company_shared_profit_balance table
   * @param outcome It's amount that company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _updateCompProfitBalance(
    profitBalance: ComProfitBalance, outcome: number, sql: QueryRunner) {
    await sql.manager.createQueryBuilder().update(ComProfitBalance)
      .set(profitBalance)
      // To avoid phantom READ,balance - outcome >= 0
      .where('balance - :outcome >= 0 AND id = :id', {
        outcome,
        id: this._comId
      })
      .execute();
  }
}