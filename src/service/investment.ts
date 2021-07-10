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
      // Insert a record to company_shared_profit_flow table.
      await InvestmentService._recordComProfitFlow(sharedProfit, sql);
      // Calculate the net addProfit from API request.It's convenience for adding or withdrawing using.
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
   * Add a record to company_shared_profit_flow table
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
    // If the record is not exists in the company_shared_profit table,then add a record or update the balance amount.
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
    // If profitBalance exists,balance should be the old amount add new netProfit.
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
    // Prepare the payload before add record to user_shares_flow table.
    const userShares = await InvestmentService._preAddRecordUserSharesFlow(investDto);
    await InvestmentService._addRecordToUserSharesFlow(userShares);
  }

  /**
   * For user disinvest.
   * @param disInvestDto It's a DTO object from API request.
   * @return - void
   */
  public async disinvest(disInvestDto: InvestOrDisInvestDto): Promise<void> {
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      const userShares = await InvestmentService._preAddRecordUserSharesFlow(disInvestDto);
      await InvestmentService._addRecordToUserSharesFlow(userShares);
      // check the user net shares,must be positive value
      await InvestmentService._checkNetSharePositive(disInvestDto.userId);
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
   * @param inOutDto It's a DTO object from API request.
   * @return UserShares It's UserShares entity.
   */
  private static async _preAddRecordUserSharesFlow(inOutDto: InvestOrDisInvestDto): Promise<UserShares> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = inOutDto.userId;
    userShares.invest = (inOutDto.amount) ? (inOutDto.amount) : new BigNumber(0).toString();
    userShares.disinvest = (inOutDto.amount) ? (inOutDto.amount) : new BigNumber(inOutDto.amount).toString();
    return userShares;
  }

  /**
   * Add a record to user_shares_flow table
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
      // check the data from user_cash_balance table
      InvestmentService._checkUserCashBalance(userCashBalance);
      const withdrawData = InvestmentService._preAddRecordToUserCashFlow(withdrawDto);
      const { balance } = userCashBalance;
      const amount = new Amount();
      amount.initBalanceAmount = balance;
      amount.depositAmount = withdrawData.deposit;
      amount.withdrawAmount = withdrawData.withdraw;
      // before access table do some general check
      await InvestmentService._checkWithdrawAmountLessThanBalance(amount);
      const newUserCashBalance = await InvestmentService._preUpdateUserCashBalance(withdrawDto.userId, amount, sql);
      // update user_cash_balance table
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
      const fromAtUnix = dayjs(fromAt).unix();
      const toAtUnix = dayjs(toAt).unix();
      const userSharesFlowRecords = await sql.manager.getRepository(UserSharesFlow).find({
        createdAt: Raw(alias => `unix_timestamp(${alias}) >= ${fromAtUnix} AND unix_timestamp(${alias}) < ${toAtUnix}`)
      });
      // Calculate user shares
      const { totalShares, userSharesMap } = InvestmentService._calculateUserShares(userSharesFlowRecords);
      // Prepare payload before insert or update user_shares_balance table
      const { userIds, updateUserShareRows } = InvestmentService.preUpdateUserShares(totalShares, userSharesMap);
      await InvestmentService._checkUserShares(userIds, updateUserShareRows);
      const userShareBalanceRepository = sql.manager.getRepository(UserSharesBalance);
      // Delete old data
      await userShareBalanceRepository.delete(userIds);
      // Insert or update user_shares_balance table
      await RepositoryService.insertOrUpdate(userShareBalanceRepository, updateUserShareRows);
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
   * Calculate user's investment shares.
   * @param userSharesRecords It's records from user_shares_flow table
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

  private static _checkUserShares(userIds: string[], updateUserShareRows: UserSharesBalance[]) {
    if (userIds.length === 0 || updateUserShareRows.length === 0) {
      throw new Error(this._noNeedShareMessage);
    }
  }

  /**
   * Prepare payload for update user_shares_balance table
   * @param totalShares It's a total number about the whole shares.
   * @param userSharesMap It's a map that store every user's shares.
   * @return - { userIds, updateUserShareRows }
   */
  private static preUpdateUserShares(totalShares: number, userSharesMap: Map<string, BigNumber>)
    : { userIds: string[], updateUserShareRows: UserSharesBalance[] } {
    const updateUserShareRows = [];
    const userIds = [];
    // DO NOT use Map.entries() that will return empty array
    for (const [userId, balance] of Object.entries(userSharesMap)) {
      const userSharesBalance = new UserSharesBalance();
      userSharesBalance.userId = userId;
      userSharesBalance.balance = balance.toString();
      userSharesBalance.proportion = new BigNumber(balance.dividedBy(totalShares).times(100)).toNumber();
      userSharesBalance.updatedAt = new Date();
      updateUserShareRows.push(userSharesBalance);
      userIds.push(userId);
    }
    return { userIds, updateUserShareRows };
  }

  /**
   * Refresh claim_booking table
   * @return - { shareProfitCandidateIds, shareProfitCandidates }
   */
  public async refreshClaimBooking(): Promise<{ shareProfitCandidateIds: string[] }> {
    const claimBookingRecords = await getRepository(ClaimBooking).find({ status: ClaimState.INIT });
    const shareProfitCandidateIds = [];
    for (const record of claimBookingRecords) {
      const _isClaimDateInPeriod = this._isClaimDateAvailable(record.createdAt);
      if (_isClaimDateInPeriod && record.status === ClaimState.INIT) {
        shareProfitCandidateIds.push(record.userId);
      } else if (record.status === ClaimState.INIT) {
        await getConnection()
          .createQueryBuilder()
          .update(ClaimBooking)
          .set({ status: ClaimState.EXPIRED })
          .where({ id: record.id })
          .execute();
      }
    }
    return { shareProfitCandidateIds };
  }

  /**
   * Is claim date in the max claimable season?
   * @param createdAt
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
   * Calculate the amount that should pay to the user.
   * @param shareProfitCandidateIds It's a user list that should be paid.
   * @return payableCandidates - It's a list that company needs to pay.
   */
  public async getPayableCandidates(shareProfitCandidateIds: string[]): Promise<Map<string, BigNumber>> {
    const CompanyProfitBalanceRepository = getRepository(ComProfitBalance);
    const { balance } = await CompanyProfitBalanceRepository.findOne(InvestmentService._comId);
    const userSharesBalanceRecords = await getRepository(UserSharesBalance).findByIds(shareProfitCandidateIds);
    const payableCandidates = new Map<string, BigNumber>();
    for (const { userId, proportion } of userSharesBalanceRecords) {
      // proportion is base on 100% expression so needs to be divided by 100 to times balance amount.
      const payableAmount = new BigNumber(proportion).dividedBy(100).times(new BigNumber(balance));
      payableCandidates.set(userId, payableAmount);
    }
    return payableCandidates;
  }

  /**
   * Company do share profit to investor.
   * @param payableCandidates It's a list that company needs to pay.
   * @return - void
   */
  public async shareProfit(payableCandidates: Map<string, BigNumber>): Promise<void> {
    await InvestmentService._checkCandidates(payableCandidates);
    const connection = getConnection();
    const sql = connection.createQueryRunner();
    let errorMessage = '';
    await sql.connect();
    await sql.startTransaction();
    try {
      const totalPayableProfit = InvestmentService._calculateTotalPayableAmount(payableCandidates);
      await InvestmentService._checkIfCompanyNeedPay(totalPayableProfit);
      await InvestmentService.runUserOperation(payableCandidates, sql);
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
   * @param payableCandidates It's a list that company needs to pay.
   * @return - void
   */
  private static _checkCandidates(payableCandidates: Map<string, BigNumber>): void {
    if (payableCandidates.size === 0) {
      throw new Error(this._noNeedShareMessage);
    }
  }

  /**
   * Run user operation.
   * @param payableCandidates It's a list that company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async runUserOperation(payableCandidates: Map<string, BigNumber>, sql: QueryRunner): Promise<void> {
    await InvestmentService._updatePayableUserCashFlow(payableCandidates, sql);
    await InvestmentService._updatePayableUserCashBalance(payableCandidates, sql);
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
   * @param payableCandidates It's a list that company needs to pay.
   * @return totalNeedShareProfit It's a sum value about the company total need to pay.
   */
  private static _calculateTotalPayableAmount(payableCandidates: Map<string, BigNumber>): BigNumber {
    let totalNeedShareProfit = new BigNumber(0);
    for (const value of payableCandidates.values()) {
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
   * @param profitCandidates It's a list that company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _updatePayableUserCashFlow(profitCandidates: Map<string, BigNumber>, sql: QueryRunner) {
    for (const [userId, payableAmount] of profitCandidates.entries()) {
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
   * Add record th user_cash_flow table
   * @param userCashFlowRecord It's a payload for adding to user_cash_flow table.
   * @param sql It's TypeORM queryRunner.
   * @return - void
   */
  private static async _addRecordToUserCashFlow(userCashFlowRecord: UserCashFlow, sql: QueryRunner) {
    const userCashFlowRepository = sql.manager.getRepository(UserCashFlow);
    // insert user_cash_flow table
    await userCashFlowRepository.insert(userCashFlowRecord);
  }

  /**
   * Update the record in user_cash_balance if the user could gain the shared profit.
   * @param profitCandidates It's the amount company needs to pay.
   * @param sql It's TypeORM QueryRunner.
   * @return - void
   */
  private static async _updatePayableUserCashBalance(profitCandidates: Map<string, BigNumber>, sql: QueryRunner)
    : Promise<void> {
    const userCashBalanceRepository = sql.manager.getRepository(UserCashBalance);
    const claimBookingRepository = sql.manager.getRepository(ClaimBooking);
    for (const [userId, payableAmount] of profitCandidates.entries()) {
      // allocate the payable amount to user
      const userCashBalance = await sql.manager.getRepository(UserCashBalance).findOne(userId);
      // check the record exists in user_cash_balance table,create a record if not exists.
      await InvestmentService.initializeUserCashBalance(userId, userCashBalance, sql);
      const amount = new Amount();
      amount.initBalanceAmount = (userCashBalance) ? userCashBalance.balance : 0;
      amount.depositAmount = payableAmount.toNumber();
      // prepare payload before updating user_cash_balance table
      const updateCashBalance = await InvestmentService._preUpdateUserCashBalance(userId, amount, sql);
      // update user_cash_balance table
      await userCashBalanceRepository.update(userId, updateCashBalance);
      const claimBooking = await claimBookingRepository.findOne({
        userId,
        status: ClaimState.INIT
      });
      claimBooking.status = ClaimState.FINISH;
      // update the status to FINISH state in claim_booking table
      await sql.manager.createQueryBuilder().update(ClaimBooking)
        .set(claimBooking)
        .where('userId = :userId AND status = :claimState', {
          userId,
          claimState: ClaimState.INIT
        })
        .execute();
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