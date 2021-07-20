import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  EntityManager,
  getManager,
  Raw
} from 'typeorm';
import { Injectable } from '@nestjs/common';

import {
  ClaimDto,
  InvestOrDisInvestDto,
  UserShares,
  WithdrawDto
} from '../dto/investment';
import { SharedProfit, SharedProfitDto } from '../dto/shared-profit';
import { ClaimBooking } from '../entity/claim-booking';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import {
  CompanySharedProfitFlow,
  CompanySharedProfitFlow as ComProfitFlow
} from '../entity/company-shared-profit-flow';
import { CompanySharedProfitBalance as ComProfitBalance } from '../entity/company-shared-profit-balance';
import { ClaimState } from '../util/state';
import { MathService } from '../util/tool';
import { UtilService } from '../util/service';
import {
  Amount,
  TimeService
} from './base';
import { InjectRepository } from '@nestjs/typeorm';
import { ClaimBookingRepository } from '../repository/claim-booking';
import { CompanyProfitBalanceRepository } from '../repository/company-shared-profit-balance';
import { CompanyProfitFlowRepository } from '../repository/company-shared-profit-flow';
import { UserCashBalanceRepository } from '../repository/user-cash-balance';
import { UserCashFlowRepository } from '../repository/user-cash-flow';
import { UserSharesBalanceRepository } from '../repository/user-shares-balance';
import { UserSharesFlowRepository } from '../repository/user-shares-flow';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private static readonly _comId = 1;
  private static readonly _noNeedShareMessage = 'No need to share profit.';

  constructor(
    private readonly _claimBookingRepo: ClaimBookingRepository,
    private readonly _userCashBalanceRepo: UserCashBalanceRepository,
    private readonly _userCashFlowRepo: UserCashFlowRepository,
    private readonly _userSharesBalanceRepo: UserSharesBalanceRepository,
    @InjectRepository(UserSharesFlow)
    private readonly _userSharesFlowRepo: UserSharesFlowRepository,
    private readonly _comProfitBalanceRepo: CompanyProfitBalanceRepository,
    private readonly _comProfitFlowRepo: CompanyProfitFlowRepository
  ) {
  }

  /**
   * For adding the company profit.
   * @param sharedProfitDto - It's the money that the company want to store in or take it out.
   * @return - void
   */
  /* istanbul ignore next */
  public async addProfit(sharedProfitDto: SharedProfitDto): Promise<void> {
    await getManager().transaction(async sql => {
      await this.addProfitTxHandler(sharedProfitDto, sql);
    });
  }

  /**
   * It's a transaction handler for adding the company profit.
   * @param sharedProfitDto - It's the money that the company want to store in or take it out.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  public async addProfitTxHandler(sharedProfitDto: SharedProfitDto, sql: EntityManager): Promise<void> {
    const comSharedProfitFlow = new CompanySharedProfitFlow();
    comSharedProfitFlow.income = new BigNumber(sharedProfitDto.income).toNumber();
    comSharedProfitFlow.outcome = new BigNumber(sharedProfitDto.outcome).toNumber();
    await this._recordComProfitFlow(comSharedProfitFlow, sql);
    const netAddProfit = await InvestmentService._calculateNetAddProfit(comSharedProfitFlow);
    await this._refreshComProfitBalance(netAddProfit, sql);
  }

  /**
   * Add a record to company_shared_profit_flow table.
   * @param comSharedProfitFlow - It's the money that the company want to store in or take it out.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _recordComProfitFlow(comSharedProfitFlow: CompanySharedProfitFlow, sql: EntityManager): Promise<void> {
    await this._comProfitFlowRepo.create(comSharedProfitFlow, sql);
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
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _refreshComProfitBalance(netAddProfit: number, sql: EntityManager): Promise<void> {
    const condition = { id: InvestmentService._comId };
    const profitBalance = await this._comProfitBalanceRepo.getOne(condition);
    const comProfitBalance = await InvestmentService._preRefreshComProfitBalance(netAddProfit, profitBalance);
    await this._comProfitBalanceRepo.createOrUpdate(comProfitBalance, sql);
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
  /* istanbul ignore next */
  public async disinvest(disInvestDto: InvestOrDisInvestDto): Promise<void> {
    await getManager().transaction(async sql => {
      await this.disinvestTxHandler(disInvestDto, sql);
    });
  }

  /**
   * It's a transaction handler for user disinvest.
   * @param disInvestDto It's a DTO object from API request.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  public async disinvestTxHandler(disInvestDto: InvestOrDisInvestDto, sql: EntityManager): Promise<void> {
    const { userId, amount } = disInvestDto;
    const userShares = await InvestmentService._preAddRecordUserSharesFlow(userId, undefined, amount);
    await this._addRecordToUserSharesFlow(userShares, sql);
    await this._checkNetSharePositive(userId);
  }

  /**
   * Prepare payload before update user_cash_flow table.
   * @param userId It's the id of the user.
   * @param investAmount It's amount for invest.
   * @param disInvestAmount It's amount for disinvest.
   * @return UserShares It's UserShares entity.
   */
  private static async _preAddRecordUserSharesFlow(userId: string, investAmount?: string, disInvestAmount?: string)
    : Promise<UserSharesFlow> {
    const userShares = new UserSharesFlow();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = userId;
    userShares.invest = (investAmount) ? (investAmount) : new BigNumber(0).toString();
    userShares.disinvest = (disInvestAmount) ? (disInvestAmount) : new BigNumber(0).toString();
    return userShares;
  }

  /**
   * Add a record to user_shares_flow table.
   * @param userShares It's how many shares user invests.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _addRecordToUserSharesFlow(userShares: UserSharesFlow, sql?: EntityManager): Promise<void> {
    await this._userSharesFlowRepo.create(userShares, sql);
  }

  /**
   * Need to make sure the net shares of the user is more than 0.
   * @param userId It's the id of the user
   * @return - void
   */
  private async _checkNetSharePositive(userId: string): Promise<void> {
    const userSharesFlowRecords = await this._userSharesFlowRepo.list({ where: { userId } });
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
    const condition = {
      where: {
        status: ClaimState.INIT,
        userId
      }
    };
    return await this._claimBookingRepo.list(condition);
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
    await this._claimBookingRepo.createOrUpdate(claimBooking);
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
  /* istanbul ignore next */
  public async withdraw(withdrawDto: WithdrawDto): Promise<void> {
    await getManager().transaction(async sql => {
      await this.withdrawTxHandler(withdrawDto, sql);
    });
  }

  /**
   * It's a transaction handler for user withdraw the money from the company share the profit.
   * @param withdrawDto It's a DTO object from API request.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  public async withdrawTxHandler(withdrawDto: WithdrawDto, sql: EntityManager): Promise<void> {
    const userCashBalance = await this._getUserCashBalance(withdrawDto.userId);
    InvestmentService._checkUserCashBalance(userCashBalance);
    const withdrawData = InvestmentService._preAddRecordToUserCashFlow(withdrawDto);
    const initBalanceAmount = userCashBalance.balance;
    const depositAmount = withdrawData.deposit;
    const withdrawAmount = withdrawData.withdraw;
    const amount = new Amount(initBalanceAmount, depositAmount, withdrawAmount);
    amount.calculateBalanceAmount();
    await InvestmentService._checkWithdrawAmountLessThanBalance(amount);
    const newUserCashBalance = await InvestmentService._preUpdateUserCashBalance(amount, userCashBalance);
    await this._updateUserCashBalanceForWithdraw(newUserCashBalance, withdrawData);
    await this._addRecordToUserCashFlow(withdrawData, sql);
  }

  /**
   * For user withdraw the money from the company share the profit.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async _getUserCashBalance(userId: string) {
    const condition = { userId };
    return await this._userCashBalanceRepo.getOne(condition);
  }

  /**
   * Check the balance in user_cash_balance table.
   * @param userCashBalance It's UserCashBalance entity.
   * @return - void
   */
  private static _checkUserCashBalance(userCashBalance: UserCashBalance): void {
    if (!userCashBalance || userCashBalance.balance === 0) {
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
   * @param userCashFlow It's UserCashFlow entity.
   * @return - void
   */
  private async _updateUserCashBalanceForWithdraw(userCashBalance: UserCashBalance, userCashFlow: UserCashFlow)
    : Promise<void> {
    await this._userCashBalanceRepo.updateForWithdraw(userCashFlow.withdraw, userCashBalance);
  }

  /**
   * Settle user's investment shares.
   * @param fromAt It's started date about settle.
   * @param toAt It's ended date about settle.
   * @return - void
   */
  /* istanbul ignore next */
  public async settleUserShares(fromAt: string, toAt: string): Promise<void> {
    await getManager().transaction(async sql => {
      await this.settleUserSharesTxHandler(fromAt, toAt, sql);
    });
  }

  /**
   * It's a transaction handler for settling user's investment shares.
   * @param fromAt It's started date about settle.
   * @param toAt It's ended date about settle.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  public async settleUserSharesTxHandler(fromAt: string, toAt: string, sql: EntityManager): Promise<void> {
    const userSharesFlowRecords = await this._getUserSharesFlowRecords(fromAt, toAt);
    const { totalShares, userSharesMap } = InvestmentService._calculateUserShares(userSharesFlowRecords);
    const { userIds, updateUserShareRows } = InvestmentService.preUpdateUserShares(totalShares, userSharesMap);
    await InvestmentService._checkUserShares(userIds, updateUserShareRows);
    await this._deleteUserSharesBalance(userIds, sql);
    await this._addRecordsToUserSharesBalance(updateUserShareRows, sql);
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
    /* istanbul ignore next */
    return await this._userSharesFlowRepo.list({
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
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _deleteUserSharesBalance(userIds: string[], sql: EntityManager): Promise<void> {
    // Delete old data
    await this._userSharesBalanceRepo.delete(userIds, sql);
  }

  /**
   * Add records in user_shares_balance table.
   * @param userSharesBalanceRows It's a list that wants to update in user_shares_balance table.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _addRecordsToUserSharesBalance(userSharesBalanceRows: UserSharesBalance[], sql: EntityManager) {
    await this._userSharesBalanceRepo.create(userSharesBalanceRows, sql);
  }

  /**
   * Get qualified claimer list.
   * @return string[] It's qualified claimer list.
   */
  public async getQualifiedClaimers(): Promise<string[]> {
    const claimBookingRecords = await this._claimBookingRepo.list({ status: ClaimState.INIT });
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
   * Set unqualified claimer's status to expired.
   * @return - void
   */
  public async setUnQualifiedClaimersExpired(): Promise<void> {
    const claimBookingRecords = await this._claimBookingRepo.list({ status: ClaimState.INIT });
    await this._setUnQualifiedClaimersExpired(claimBookingRecords);
  }

  /**
   * Set unqualified claimer's status to expired.
   * @return - void
   */
  private async _setUnQualifiedClaimersExpired(claimBookingRecords: ClaimBooking[]): Promise<void> {
    for (const record of claimBookingRecords) {
      const isClaimDateInPeriod = this._isClaimDateAvailable(record.createdAt);
      if (!isClaimDateInPeriod && record.status === ClaimState.INIT) {
        await this._setExpiredInClaimBooking(record);
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
   * @param claimBooking It's a record about claim booking.
   * @return - void
   */
  private async _setExpiredInClaimBooking(claimBooking: ClaimBooking): Promise<void> {
    const { id } = claimBooking;
    claimBooking.status = ClaimState.EXPIRED;
    claimBooking.updatedAt = new Date();
    await this._claimBookingRepo.update({ id }, claimBooking);
  }

  /**
   * Calculate the amount that should pay to the user.
   * @param shareProfitClaimerIds It's a user list that should be paid.
   * @return payableClaimers - It's a list that company needs to pay.
   */
  public async getPayableClaimers(shareProfitClaimerIds: string[]): Promise<Map<string, BigNumber>> {
    const condition = { id: InvestmentService._comId };
    const { balance } = await this._comProfitBalanceRepo.getOne(condition);
    const userSharesBalanceRecords = await this._userSharesBalanceRepo.listByIds(shareProfitClaimerIds);
    const payableClaimers = new Map<string, BigNumber>();
    for (const { userId, proportion } of userSharesBalanceRecords) {
      // proportion is base on 100% expression so needs to be divided by 100 to times balance amount.
      const oneHundredPercent = 100;
      const payableAmount = new BigNumber(proportion).dividedBy(oneHundredPercent).times(new BigNumber(balance));
      payableClaimers.set(userId, payableAmount);
    }
    return payableClaimers;
  }

  /**
   * Company do share profit to investor.
   * @param payableClaimers It's a list that company needs to pay.
   * @return - void
   */
  /* istanbul ignore next */
  public async shareProfit(payableClaimers: Map<string, BigNumber>): Promise<void> {
    await getManager().transaction(async sql => {
      await this.shareProfitTxHandler(payableClaimers, sql);
    });
  }

  /**
   * It's a transaction handler for company sharing profit to investor.
   * @param payableClaimers It's a list that company needs to pay.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  public async shareProfitTxHandler(payableClaimers: Map<string, BigNumber>, sql: EntityManager): Promise<void> {
    await InvestmentService._checkClaimers(payableClaimers);
    const totalPayableProfit = InvestmentService._calculateTotalPayableAmount(payableClaimers);
    await InvestmentService._checkIfCompanyNeedPay(totalPayableProfit);
    await this.runUserOperation(payableClaimers, sql);
    await this.runCompOperation(totalPayableProfit, sql);
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
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async runUserOperation(payableClaimers: Map<string, BigNumber>, sql: EntityManager): Promise<void> {
    await this.distributeProfit(payableClaimers, sql);
    await this._updatePayableClaimerCashBalance(payableClaimers);
  }

  /**
   * Run company operation.
   * @param totalPayableProfit It's a sum value about the company total need to pay.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async runCompOperation(totalPayableProfit, sql: EntityManager): Promise<void> {
    const companySharedProfitFlow = InvestmentService._preInsertCompSharedProfitFlow(totalPayableProfit);
    await this._recordComProfitFlow(companySharedProfitFlow, sql);
    const { outcome } = companySharedProfitFlow;
    const updateProfitBalance = await this._preUpdateCompProfitBalance(InvestmentService._comId, outcome);
    await this._updateCompProfitBalance(outcome, updateProfitBalance);
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
   * Add record to user's cash flow if the user is available to gain the shared profit.
   * @param profitClaimers It's a list that company needs to pay.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async distributeProfit(profitClaimers: Map<string, BigNumber>, sql: EntityManager) {
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      await this._allocateFunds(userId, payableAmount.toNumber(), sql);
    }
  }

  /**
   * Company distribute the shared profit to user.
   * @param userId It's the id of the user.
   * @param payableAmount It's the amount company needs to pay.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _allocateFunds(userId, payableAmount: number, sql: EntityManager): Promise<void> {
    const userCashFlow = new UserCashFlow();
    userCashFlow.id = UtilService.genUniqueId();
    userCashFlow.userId = userId;
    userCashFlow.deposit = new BigNumber(payableAmount).toNumber();
    userCashFlow.withdraw = 0;
    await this._addRecordToUserCashFlow(userCashFlow, sql);
  }

  /**
   * Add record th user_cash_flow table.
   * @param userCashFlowRecord It's a payload for adding to user_cash_flow table.
   * @param sql It's a EntityManager for doing transaction.
   * @return - void
   */
  private async _addRecordToUserCashFlow(userCashFlowRecord: UserCashFlow, sql: EntityManager) {
    await this._userCashFlowRepo.create(userCashFlowRecord, sql);
  }

  /**
   * Update the record in user_cash_balance if the user could gain the shared profit.
   * @param profitClaimers It's the amount company needs to pay.
   * @return - void
   */
  private async _updatePayableClaimerCashBalance(profitClaimers: Map<string, BigNumber>)
    : Promise<void> {
    for (const [userId, payableAmount] of profitClaimers.entries()) {
      const condition = { userId };
      let userCashBalance = await this._userCashBalanceRepo.getOne(condition);
      if (!userCashBalance) {
        userCashBalance = await this.initializeUserCashBalance(userId);
      }
      const initBalanceAmount = (userCashBalance) ? userCashBalance.balance : 0;
      const depositAmount = payableAmount.toNumber();
      const withdrawAmount = 0;
      const amount = new Amount(initBalanceAmount, depositAmount, withdrawAmount);
      amount.calculateBalanceAmount();
      const updateCashBalance = await InvestmentService._preUpdateUserCashBalance(amount, userCashBalance);
      await this._userCashBalanceRepo.update(condition, updateCashBalance);
      await this._setFinishToQualifiedClaimer(userId);
    }
  }

  /**
   * Initialize user's balance amount in user_cash_balance table if the record is not exists.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async initializeUserCashBalance(userId: string) {
    const userCashBalance = new UserCashBalance();
    userCashBalance.userId = userId;
    userCashBalance.balance = 0;
    await this._userCashBalanceRepo.create(userCashBalance);
    return userCashBalance;
  }

  /**
   * Prepare the payload before updating the user_cash_balance table.
   * @param amount It's a instance from Amount class.
   * @param userCashBalanceRecord It's a record about user cash balance.
   * @return UserCashBalance
   */
  private static async _preUpdateUserCashBalance(amount: Amount, userCashBalanceRecord: UserCashBalance)
    : Promise<UserCashBalance> {
    amount.calculateBalanceAmount();
    userCashBalanceRecord.balance = amount.balanceAmount;
    userCashBalanceRecord.updatedAt = new Date();
    return userCashBalanceRecord;
  }

  /**
   * Set qualified claimer's status to expired.
   * @param userId It's the id of the user.
   * @return - void
   */
  private async _setFinishToQualifiedClaimer(userId: string): Promise<void> {
    const condition = {
      userId,
      status: ClaimState.INIT
    };
    const claimBooking = await this._claimBookingRepo.getOne(condition);
    claimBooking.status = ClaimState.FINISH;
    await this._claimBookingRepo.update(condition, claimBooking);
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
    const condition = { id: companyId };
    const companyProfitBalance = await this._comProfitBalanceRepo.getOne(condition);
    const updateBalance = new BigNumber(companyProfitBalance.balance).minus(outcome).toNumber();
    companyProfitBalance.id = companyId;
    companyProfitBalance.balance = updateBalance;
    return companyProfitBalance;
  }

  /**
   * Update company profit balance.
   * @param outcome It's amount that company needs to pay.
   * @param profitBalance It's a payload that for updating company_shared_profit_balance table
   * @return - void
   */
  private async _updateCompProfitBalance(outcome: number, profitBalance: ComProfitBalance) {
    await this._comProfitBalanceRepo.updateOutcome(InvestmentService._comId, outcome, profitBalance);
  }
}