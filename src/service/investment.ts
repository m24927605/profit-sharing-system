import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  getConnection,
  getRepository,
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
import { genSeasonDate } from '../util/season';
import { MathService } from '../util/tool';
import { UtilService } from '../util/service';
import { RepositoryService } from './base';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private readonly _companyProfitBalanceId = 1;

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
      // Add a record to company_profit_flow table.
      await RepositoryService.insertOrUpdate(companyProfitFlowRepository, sharedProfit);
      // Calculate the net addProfit from API request.
      const netAddProfit = MathService.minus(income, outcome).toNumber();
      const profitBalance = await companyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
      // prepare the payload before insert or update action.
      const companySharedProfitBalance = await this._preInsertOrUpdateCompanyProfitBalance(netAddProfit, profitBalance);
      // If the record is not exists in the company_shared_profit table,then add a record or update the balance amount.
      await RepositoryService.insertOrUpdate(companyProfitBalanceRepository, companySharedProfitBalance);
      await queryRunner.commitTransaction();
    } catch (e) {
      errorMessage = e.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

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

  public async invest(investDto: InvestDto): Promise<void> {
    const userSharesFlowRepository = getRepository(UserSharesFlow);
    // Prepare the payload before add record to user_shares_flow table.
    const userShares = this._preInvest(investDto);
    await RepositoryService.insertOrUpdate(userSharesFlowRepository, userShares);
  }

  private _preInvest(investDto: InvestDto): UserShares {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = investDto.userId;
    userShares.invest = new BigNumber(investDto.amount).toString();
    userShares.disinvest = new BigNumber(0).toString();
    return userShares;
  }

  public async disinvest(disInvestDto: DisInvestDto): Promise<void> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    let errorMessage = '';
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Prepare payload before update user_cash_flow table.
      const userShares = await this._preUpdateUserCashFlow(disInvestDto);
      const userSharesFlowRepository = queryRunner.manager.getRepository(UserSharesFlow);
      await RepositoryService.insertOrUpdate(userSharesFlowRepository, userShares);
      // Need to make sure the net shares of the user is more than 0.
      await this._checkUserNetSharesPositive(disInvestDto.userId, userSharesFlowRepository);
      await queryRunner.commitTransaction();
    } catch (e) {
      errorMessage = e.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  private async _preUpdateUserCashFlow(disInvestDto: DisInvestDto): Promise<UserShares> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = disInvestDto.userId;
    userShares.invest = new BigNumber(0).toString();
    userShares.disinvest = new BigNumber(disInvestDto.amount).toString();
    return userShares;
  }

  protected async _checkUserNetSharesPositive(userId: string, userSharesRepo: Repository<UserShares>): Promise<void> {
    const userSharesFlowRecords = await userSharesRepo.find({ where: { userId } });
    let netShares = new BigNumber(0);
    for (const { invest, disinvest } of userSharesFlowRecords) {
      netShares = netShares.plus(new BigNumber(invest)).minus(disinvest);
    }
    if (netShares.isLessThan(0)) {
      throw new Error('User net shares cannot be less than 0');
    }
  }

  public async claim(claimDto: ClaimDto): Promise<void> {
    const nowDate = new Date();
    const claimBooking = new ClaimBooking();
    claimBooking.id = UtilService.genUniqueId();
    claimBooking.userId = claimDto.userId;
    const claimBookingRepository = getRepository(ClaimBooking);
    const claimBookingRecords = await claimBookingRepository.find({
      where: {
        status: ClaimState.INIT,
        userId: claimDto.userId
      }
    });
    for (const { createdAt } of claimBookingRecords) {
      const season = dayjs(createdAt).quarter();
      const seasonMap = genSeasonDate(dayjs(createdAt).toDate());
      const { fromAt, toAt } = seasonMap.get(season);
      const isAfterFromAt = dayjs(nowDate).unix() - dayjs(fromAt).unix() >= 0;
      const isBeforeToAt = dayjs(toAt).unix() - dayjs(nowDate).unix() >= 0;
      if (isAfterFromAt && isBeforeToAt) {
        throw new Error('Cannot duplicated claim in the same season.');
      }
    }
    await claimBookingRepository.save(claimBooking);
  }

  public async withdraw(withdrawDto: WithdrawDto): Promise<void> {
    let errorMessage = '';
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const withDraw = new WithDraw();
      withDraw.id = UtilService.genUniqueId();
      withDraw.userId = withdrawDto.userId;
      withDraw.withdraw = new BigNumber(withdrawDto.amount).toNumber();
      withDraw.deposit = new BigNumber(0).toNumber();
      const UserCashBalanceRepository = queryRunner.manager.getRepository(UserCashBalance);
      const userCashBalance = await UserCashBalanceRepository.findOne(withdrawDto.userId);
      if (userCashBalance.balance < withDraw.withdraw) {
        throw new Error('Withdraw amount must small than balance.');
      }
      userCashBalance.balance = new BigNumber(userCashBalance.balance).plus(withDraw.deposit).minus(withDraw.withdraw).toNumber();
      const UserCashFlowRepository = queryRunner.manager.getRepository(UserCashFlow);
      await UserCashFlowRepository.save(withDraw);
      await queryRunner.manager.createQueryBuilder().update(UserCashBalance)
        .set(userCashBalance)
        .where('balance - :withdraw >= 0 AND userId = :userId', {
          withdraw: withDraw.withdraw,
          userId: withdrawDto.userId
        })
        .execute();
      await queryRunner.commitTransaction();

    } catch (e) {
      errorMessage = e.message;
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    if (errorMessage) throw new Error(errorMessage);
  }

  // Calculate by season
  public async recordSharedProfitBalance(fromAt: string, toAt: string): Promise<void> {
    const companyProfitRecords = await getRepository(CompanySharedProfitFlow).find({
      createdAt: Raw(alias => `unix_timestamp(${alias}) >= ${dayjs(fromAt).unix()} AND unix_timestamp(${alias}) < ${dayjs(toAt).unix()}`)
    });
    let netIncome = 0;
    for (const { income, outcome } of companyProfitRecords) {
      netIncome = new BigNumber(netIncome).plus(new BigNumber(income)).minus(new BigNumber(outcome)).toNumber();
    }
    const CompanyProfitBalanceRepository = getRepository(CompanySharedProfitBalance);
    let companyProfitBalance = await CompanyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
    if (!companyProfitBalance) {
      const companyProfitBalance = new CompanySharedProfitBalance();
      companyProfitBalance.id = this._companyProfitBalanceId;
      companyProfitBalance.balance = 0;
      await CompanyProfitBalanceRepository.save(companyProfitBalance);
    }
    companyProfitBalance = await CompanyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
    const balance = new BigNumber(companyProfitBalance.balance).plus(new BigNumber(netIncome)).toNumber();
    await CompanyProfitBalanceRepository.update(
      { id: this._companyProfitBalanceId }, {
        balance,
        updatedAt: new Date()
      });
  }

  // Calculate by season
  public async settleUserShares(fromAt: string, toAt: string): Promise<void> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userSharesMap = new Map<bigint, BigNumber>();
      const userSharesFlowRecords = await queryRunner.manager.getRepository(UserSharesFlow).find({
        createdAt: Raw(alias => `unix_timestamp(${alias}) >= ${dayjs(fromAt).unix()} AND unix_timestamp(${alias}) < ${dayjs(toAt).unix()}`)
      });

      let totalShares = new BigNumber(0);
      for (const { userId, invest, disinvest } of userSharesFlowRecords) {
        userSharesMap[userId] = userSharesMap[userId] ?? 0;
        const investAmount = new BigNumber(invest);
        const disinvestAmount = new BigNumber(disinvest);
        userSharesMap[userId] = new BigNumber(userSharesMap[userId]).plus(investAmount).minus(disinvestAmount);
        totalShares = totalShares.plus(investAmount).minus(disinvestAmount);
      }

      const updateArray = [];
      const userIds = [];
      for (let [key, value] of Object.entries(userSharesMap)) {
        const userSharesBalance = new UserSharesBalance();
        value = new BigNumber(value);
        userSharesBalance.userId = key;
        userSharesBalance.balance = value.toString();
        userSharesBalance.proportion = new BigNumber(value.dividedBy(totalShares).times(100)).toNumber();
        userSharesBalance.updatedAt = new Date();
        updateArray.push(userSharesBalance);
        userIds.push(key);
      }
      await queryRunner.manager.getRepository(UserSharesBalance).delete(userIds);
      await queryRunner.manager.getRepository(UserSharesBalance).save(updateArray);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  public async calculateUserGainProfit(): Promise<Map<string, BigNumber>> {
    const currentSeason = InvestmentService._getCurrentSeason();
    const claimBookingRecords = await getRepository(ClaimBooking).find({ status: ClaimState.INIT });
    const shareProfitCandidatesIds = [];
    const shareProfitCandidates = new Map();
    for (const record of claimBookingRecords) {
      const seasonMap = genSeasonDate(new Date());
      const isClaimInPeriod = dayjs(seasonMap.get(currentSeason).fromAt).subtract(this._maxClaimableSeason * 3, 'months').diff(dayjs(record.createdAt)) <= 0;
      if (isClaimInPeriod && record.status === ClaimState.INIT) {
        shareProfitCandidates[record.userId] = 0;
        shareProfitCandidatesIds.push(record.userId);
      } else if (record.status === ClaimState.INIT) {
        await getConnection()
          .createQueryBuilder()
          .update(ClaimBooking)
          .set({ status: ClaimState.EXPIRED })
          .where({ id: record.id })
          .execute();
      }
    }

    const CompanyProfitBalanceRepository = getRepository(CompanySharedProfitBalance);
    const { balance: companyProfitBalance } = await CompanyProfitBalanceRepository.findOne(this._companyProfitBalanceId);
    const userSharesBalanceRecords = await getRepository(UserSharesBalance).findByIds(shareProfitCandidatesIds);
    for (const { userId, proportion } of userSharesBalanceRecords) {
      shareProfitCandidates[userId] = new BigNumber(proportion).dividedBy(100).times(new BigNumber(companyProfitBalance));
    }
    return shareProfitCandidates;
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
    } catch (e) {
      errorMessage = e.message;
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

  private static _getCurrentSeason(): number {
    return dayjs().quarter();
  }
}