import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  getConnection,
  getRepository,
  QueryRunner,
  Raw,
  Repository
} from 'typeorm';
import { Injectable } from '@nestjs/common';

import {
  ClaimDto,
  DisInvestDto,
  InvestDto,
  UserShares,
  WithDraw,
  WithdrawDto
} from '../dto/investment';
import { SharedProfit } from '../dto/shared-profit';
import { ClaimBooking } from '../entity/claim-booking';
import { CompanySharedProfitFlow } from '../entity/company-shared-profit-flow';
import { CompanySharedProfitBalance } from '../entity/company-shared-profit-balance';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import { ClaimState } from '../util/state';
import { MathService } from '../util/tool';
import { UtilService } from '../util/service';
import { RepositoryService, TimeService } from './base';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private readonly _companyProfitBalanceId = 1;

  /**
   * For adding or updating the company profit.
   * @param sharedProfit - It's the money that the company want to store in or take it out.
   * @return void
   */
  public async addOrUpdateProfit(sharedProfit: SharedProfit): Promise<void> {
    const { income, outcome } = sharedProfit;
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    const companyProfitFlowRepository = queryRunner.manager.getRepository(CompanySharedProfitFlow);
    const companyProfitBalanceRepository = queryRunner.manager.getRepository(CompanySharedProfitBalance);
    let errorMessage = '';
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await RepositoryService.insertOrUpdate(companyProfitFlowRepository, sharedProfit);
      // Calculate the net addProfit from API request.It's convenience for adding or withdrawing using.
      const netAddProfit = MathService.minus(income, outcome).toNumber();
      const profitBalance = await companyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
      const companySharedProfitBalance = await this._preInsertOrUpdateCompanyProfitBalance(netAddProfit, profitBalance);
      // If the record is not exists in the company_shared_profit table,then add a record or update the balance amount.
      await RepositoryService.insertOrUpdate(companyProfitBalanceRepository, companySharedProfitBalance);
      await queryRunner.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Prepare the payload before insert or update action.
   * @param netProfit The net amount is calculated from API request.
   * @param profitBalance CompanySharedProfitBalance entity.
   */
  private async _preInsertOrUpdateCompanyProfitBalance(netProfit: number, profitBalance: CompanySharedProfitBalance) {
    const companySharedProfitBalance = new CompanySharedProfitBalance();
    companySharedProfitBalance.id = this._companyProfitBalanceId;
    companySharedProfitBalance.balance = netProfit;
    // If profitBalance exists,balance should be the old amount add new netProfit.
    if (profitBalance) {
      const { balance } = profitBalance;
      companySharedProfitBalance.balance = MathService.plus(balance, netProfit).toNumber();
    }
    return companySharedProfitBalance;
  }

  /**
   * For user invest.
   * @param investDto It's a DTO object from API request.
   * @return void
   */
  public async invest(investDto: InvestDto): Promise<void> {
    const userSharesFlowRepository = getRepository(UserSharesFlow);
    // Prepare the payload before add record to user_shares_flow table.
    const userShares = InvestmentService._preInvest(investDto);
    await RepositoryService.insertOrUpdate(userSharesFlowRepository, userShares);
  }

  /**
   * Prepare the payload before insert or update action.
   * @param investDto It's a DTO object from API request.
   * @return UserShares
   */
  private static _preInvest(investDto: InvestDto): UserShares {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = investDto.userId;
    userShares.invest = new BigNumber(investDto.amount).toString();
    userShares.disinvest = new BigNumber(0).toString();
    return userShares;
  }

  /**
   * For user disinvest.
   * @param disInvestDto It's a DTO object from API request.
   * @return void
   */
  public async disinvest(disInvestDto: DisInvestDto): Promise<void> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    let errorMessage = '';
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userShares = await InvestmentService._preUpdateUserCashFlow(disInvestDto);
      const userSharesFlowRepository = queryRunner.manager.getRepository(UserSharesFlow);
      await RepositoryService.insertOrUpdate(userSharesFlowRepository, userShares);
      // check the user net shares,must be positive value
      await InvestmentService._checkNetSharePositive(disInvestDto.userId, userSharesFlowRepository);
      await queryRunner.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Prepare payload before update user_cash_flow table.
   * @param disInvestDto It's a DTO object from API request.
   * @return UserShares It's UserShares entity.
   */
  private static async _preUpdateUserCashFlow(disInvestDto: DisInvestDto): Promise<UserShares> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = disInvestDto.userId;
    userShares.invest = new BigNumber(0).toString();
    userShares.disinvest = new BigNumber(disInvestDto.amount).toString();
    return userShares;
  }

  /**
   * Need to make sure the net shares of the user is more than 0.
   * @param userId It's the id of the user
   * @param userSharesRepo The repository is mapping to user_share_flow table
   * @return void
   */
  private static async _checkNetSharePositive(userId: string, userSharesRepo: Repository<UserShares>): Promise<void> {
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
   * @param userId It's the id of the user.
   * @return void
   */
  public async claim({ userId }: ClaimDto): Promise<void> {
    const claimBookingRepository = getRepository(ClaimBooking);
    const claimBookingRecords = await claimBookingRepository.find({
      where: {
        status: ClaimState.INIT,
        userId
      }
    });
    InvestmentService._checkClaimRecordNotDuplicated(claimBookingRecords);
    const claimBooking = new ClaimBooking();
    claimBooking.id = UtilService.genUniqueId();
    claimBooking.userId = userId;
    await RepositoryService.insertOrUpdate(claimBookingRepository, claimBooking);
  }

  /**
   * Check the record is not duplicated.
   * @param claimBookingRecords It's ClaimBooking entity array data.
   * @return void
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
   * @return void
   */
  public async withdraw(withdrawDto: WithdrawDto): Promise<void> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    let errorMessage = '';
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const UserCashBalanceRepository = queryRunner.manager.getRepository(UserCashBalance);
      const userCashBalance = await UserCashBalanceRepository.findOne(withdrawDto.userId);
      // check the data from user_cash_balance table
      InvestmentService._checkUserCashBalance(userCashBalance);
      const withdrawData = InvestmentService._preInsertOrUpdateUserCashFlow(withdrawDto);
      const { balance: balanceAmount } = userCashBalance;
      const withdrawAmount = withdrawData.withdraw;
      const depositAmount = withdrawData.deposit;
      // before access table do some general check
      await InvestmentService._checkWithdrawAmountLessThanBalance(withdrawAmount, balanceAmount);
      const newUserCashBalance = userCashBalance;
      newUserCashBalance.balance = MathService.plus(balanceAmount, depositAmount).minus(withdrawAmount).toNumber();
      // update user_cash_balance table
      await InvestmentService._updateUserCashBalance(newUserCashBalance, withdrawData, queryRunner);
      const UserCashFlowRepository = queryRunner.manager.getRepository(UserCashFlow);
      // insert user_cash_flow table
      await RepositoryService.insertOrUpdate(UserCashFlowRepository, withdrawData);
      await queryRunner.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Check the balance in user_cash_balance table.
   * @param userCashBalance It's UserCashBalance entity.
   * @return void
   */
  private static _checkUserCashBalance(userCashBalance: UserCashBalance): void {
    if (!userCashBalance) {
      throw  new Error('The balance of the user is 0.');
    }
  }

  /**
   * Check the withdraw amount is less than balance amount or not.
   * @param withdraw It's withdraw amount.
   * @param balance It's balance amount.
   * @return void
   */
  private static _checkWithdrawAmountLessThanBalance(withdraw: number, balance: number): void {
    if (new BigNumber(withdraw).isGreaterThan(new BigNumber(balance))) {
      throw new Error('Withdraw amount must less than balance.');
    }
  }

  /**
   * Prepare the payload for insert or update user_cash_flow table.
   * @param withdrawDto It's a DTO object from API request.
   * @return WithDraw It's WithDraw entity.
   */
  private static _preInsertOrUpdateUserCashFlow(withdrawDto: WithdrawDto): WithDraw {
    const withDraw = new WithDraw();
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
   * @return void
   */
  private static async _updateUserCashBalance(userCashBalance: UserCashBalance, withDraw: WithDraw, sql: QueryRunner)
    : Promise<void> {
    await sql.manager.createQueryBuilder().update(UserCashBalance)
      .set(userCashBalance)
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
   * @return void
   */
  public async settleUserShares(fromAt: string, toAt: string): Promise<void> {
    let errorMessage = '';
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const fromAtUnix = dayjs(fromAt).unix();
      const toAtUnix = dayjs(toAt).unix();
      const userSharesFlowRecords = await queryRunner.manager.getRepository(UserSharesFlow).find({
        createdAt: Raw(alias => `unix_timestamp(${alias}) >= ${fromAtUnix} AND unix_timestamp(${alias}) < ${toAtUnix}`)
      });
      // Calculate user shares
      const { totalShares, userSharesMap } = InvestmentService._calculateUserShares(userSharesFlowRecords);
      // Prepare payload before insert or update user_shares_balance table
      const { userIds, updateUserShareRows } = InvestmentService.preUpdateUserShare(totalShares, userSharesMap);
      const userShareBalanceRepository = queryRunner.manager.getRepository(UserSharesBalance);
      // Delete old data
      await userShareBalanceRepository.delete(userIds);
      // Insert or update user_shares_balance table
      await RepositoryService.insertOrUpdate(userShareBalanceRepository, updateUserShareRows);
      await queryRunner.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  /**
   * Calculate user's investment shares.
   * @param userSharesRecords It's records from user_shares_flow table
   * @return - {totalShares,userSharesMap}
   */
  private static _calculateUserShares(userSharesRecords: UserSharesFlow[])
    : { totalShares: number, userSharesMap: Map<bigint, BigNumber> } {
    const userSharesMap = new Map<bigint, BigNumber>();
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
   * Prepare payload for update user_shares_balance table
   * @param totalShares It's a total number about the whole shares.
   * @param userSharesMap It's a map that store every user's shares.
   * @return - { userIds, updateUserShareRows }
   */
  private static preUpdateUserShare(totalShares: number, userSharesMap: Map<bigint, BigNumber>)
    : { userIds: string[], updateUserShareRows: UserSharesBalance[] } {
    const updateUserShareRows = [];
    const userIds = [];
    for (let [key, value] of Object.entries(userSharesMap)) {
      const userSharesBalance = new UserSharesBalance();
      value = new BigNumber(value);
      userSharesBalance.userId = key;
      userSharesBalance.balance = value.toString();
      userSharesBalance.proportion = new BigNumber(value.dividedBy(totalShares).times(100)).toNumber();
      userSharesBalance.updatedAt = new Date();
      updateUserShareRows.push(userSharesBalance);
      userIds.push(key);
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
   * @private
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
    const CompanyProfitBalanceRepository = getRepository(CompanySharedProfitBalance);
    const { balance } = await CompanyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
    const userSharesBalanceRecords = await getRepository(UserSharesBalance).findByIds(shareProfitCandidateIds);
    const payableCandidates = new Map<string, BigNumber>();
    for (const { userId, proportion } of userSharesBalanceRecords) {
      // proportion is base on 100% expression so needs to be divided by 100 to times balance amount.
      const payableAmount = new BigNumber(proportion).dividedBy(100).times(new BigNumber(balance));
      payableCandidates.set(userId, payableAmount);
    }
    return payableCandidates;
  }

  public async doShareProfit(shareProfitCandidates: Map<string, BigNumber>): Promise<void> {
    if (Object.entries(shareProfitCandidates).length === 0) {
      throw new Error('No need to share profit.');
    }
    let errorMessage = '';
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const totalNeedShareProfit = await InvestmentService._updateUserCashFlowAndBalance(shareProfitCandidates);
      // check if company needs to share profit
      if (totalNeedShareProfit.toNumber() <= 0) {
        throw new Error('No need to share profit.');
      }
      const companySharedProfitFlow = new CompanySharedProfitFlow();
      companySharedProfitFlow.income = 0;
      companySharedProfitFlow.outcome = totalNeedShareProfit.toNumber();
      await queryRunner.manager.getRepository(CompanySharedProfitFlow).insert(companySharedProfitFlow);
      const companySharedProfitBalance = await queryRunner.manager.getRepository(CompanySharedProfitBalance).findOne(this._companyProfitBalanceId);
      companySharedProfitBalance.id = this._companyProfitBalanceId;
      companySharedProfitBalance.balance = new BigNumber(companySharedProfitBalance.balance).minus(companySharedProfitFlow.outcome).toNumber();
      await queryRunner.manager.createQueryBuilder().update(CompanySharedProfitBalance)
        .set(companySharedProfitBalance)
        .where('balance - :outcome >= 0 AND id = :id', {
          outcome: companySharedProfitFlow.outcome,
          id: this._companyProfitBalanceId
        })
        .execute();

      await queryRunner.commitTransaction();
    } catch (error) {
      errorMessage = error.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  private static async _updateUserCashFlowAndBalance(shareProfitCandidates: Map<string, BigNumber>): Promise<BigNumber> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let totalNeedShareProfit = new BigNumber(0);
    try {
      for (const [key, value] of Object.entries(shareProfitCandidates)) {
        totalNeedShareProfit = totalNeedShareProfit.plus(value);
        const userCashFlow = new UserCashFlow();
        userCashFlow.id = UtilService.genUniqueId();
        userCashFlow.userId = key;
        userCashFlow.deposit = new BigNumber(value).toNumber();
        userCashFlow.withdraw = 0;
        const userCashFlowRepository = await queryRunner.manager.getRepository(UserCashFlow);
        await userCashFlowRepository.save(userCashFlow);
        let userCashBalance = await queryRunner.manager.getRepository(UserCashBalance).findOne(key);
        if (!userCashBalance) {
          const userCashBalance = new UserCashBalance();
          userCashBalance.userId = key;
          userCashBalance.balance = 0;
          await queryRunner.manager.getRepository(UserCashBalance).save(userCashBalance);
        }
        userCashBalance = await queryRunner.manager.getRepository(UserCashBalance).findOne(key);
        userCashBalance.userId = key;
        userCashBalance.balance = new BigNumber(userCashBalance.balance).plus(new BigNumber(value)).toNumber();
        await queryRunner.manager.getRepository(UserCashBalance).save(userCashBalance);
        const claimBooking = await queryRunner.manager.getRepository(ClaimBooking).findOne({
          userId: key,
          status: ClaimState.INIT
        });
        claimBooking.status = ClaimState.FINISH;
        await queryRunner.manager.createQueryBuilder().update(ClaimBooking)
          .set(claimBooking)
          .where('userId = :userId AND status = :claimState', {
            userId: key,
            claimState: ClaimState.INIT
          })
          .execute();
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return totalNeedShareProfit;
  }
}