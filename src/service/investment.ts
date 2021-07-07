import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import {
  getConnection,
  getRepository,
  In,
  Raw
} from 'typeorm';
import { Injectable } from '@nestjs/common';

import {
  ClaimDto,
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
import { UtilService } from '../util/service';
import { seasonMap } from '../util/season';

dayjs.extend(quarterOfYear);

@Injectable()
export class InvestmentService {
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);
  private readonly _companyProfitBalanceId = 1;

  public async addProfit(sharedProfit: SharedProfit): Promise<void> {
    // get a connection and create a new query runner
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    // establish real database connection using our new query runner
    await queryRunner.connect();
    // lets now open a new transaction:
    await queryRunner.startTransaction();
    try {
      const shareProfitRepository = queryRunner.manager.getRepository(CompanySharedProfitFlow);
      await shareProfitRepository.save(sharedProfit);
      const shareProfitBalanceRepository = queryRunner.manager.getRepository(CompanySharedProfitBalance);
      const profitBalance = await shareProfitBalanceRepository.findOne(this._companyProfitBalanceId);
      const companySharedProfitBalance = new CompanySharedProfitBalance();
      companySharedProfitBalance.id = this._companyProfitBalanceId;
      const netAddProfit = new BigNumber(sharedProfit.income).minus(sharedProfit.outcome);
      if (!profitBalance) {
        companySharedProfitBalance.balance = new BigNumber(netAddProfit).toNumber();
      } else {
        companySharedProfitBalance.balance = new BigNumber(profitBalance.balance).plus(netAddProfit).toNumber();
      }
      await shareProfitBalanceRepository.save(companySharedProfitBalance);
      // commit transaction now
      await queryRunner.commitTransaction();
    } catch (e) {
      // since we have errors let's rollback changes we made
      await queryRunner.rollbackTransaction();
    } finally {
      // you need to release query runner which is manually created:
      await queryRunner.release();
    }
  }

  public async invest(investDto: InvestDto): Promise<void> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = investDto.userId;
    userShares.invest = new BigNumber(investDto.amount).toString();
    userShares.disinvest = new BigNumber(0).toString();
    const UserSharesFlowRepository = getRepository(UserSharesFlow);
    await UserSharesFlowRepository.save(userShares);
  }

  public async claim(claimDto: ClaimDto): Promise<void> {
    const nowSeason = dayjs().quarter();
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
      const claimSeason = dayjs(createdAt).quarter();
      if (nowSeason === claimSeason) {
        throw new Error('Cannot duplicated claim in the same season.');
      }
    }
    await claimBookingRepository.save(claimBooking);
  }

  public async withdraw(withdrawDto: WithdrawDto): Promise<void> {
    let errorMessage = '';
    // get a connection and create a new query runner
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    // establish real database connection using our new query runner
    await queryRunner.connect();
    // lets now open a new transaction:
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
      // commit transaction now
      await queryRunner.commitTransaction();

    } catch (e) {
      errorMessage = e.message;
      // since we have errors let's rollback changes we made
      await queryRunner.rollbackTransaction();
    } finally {
      // you need to release query runner which is manually created:
      await queryRunner.release();
      if (errorMessage) throw new Error(errorMessage);
    }
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
  public async recordUserSharesBalance(fromAt: string, toAt: string): Promise<void> {
    // get a connection and create a new query runner
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    // establish real database connection using our new query runner
    await queryRunner.connect();
    // lets now open a new transaction:
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
        userSharesBalance.proportion = Number(new BigNumber(value.dividedBy(totalShares) * 100).toFixed(2));
        userSharesBalance.updatedAt = new Date();
        updateArray.push(userSharesBalance);
        userIds.push(key);
      }
      await queryRunner.manager.getRepository(UserSharesBalance).delete(userIds);
      await queryRunner.manager.getRepository(UserSharesBalance).save(updateArray);
      // commit transaction now
      await queryRunner.commitTransaction();
    } catch (err) {
      // since we have errors let's rollback changes we made
      await queryRunner.rollbackTransaction();
    } finally {
      // you need to release query runner which is manually created
      await queryRunner.release();
    }
  }

  public async calculateUserGainProfit(): Promise<Map<string, BigNumber>> {
    const currentSeason = this._getCurrentSeason();
    const claimBookingRecords = await getRepository(ClaimBooking).find({ status: ClaimState.INIT });
    const shareProfitCandidatesIds = [];
    const profitExpiredCandidatesIds = [];
    const shareProfitCandidates = new Map();
    for (const record of claimBookingRecords) {
      const isClaimInPeriod = dayjs(seasonMap.get(currentSeason).fromAt).subtract(this._maxClaimableSeason * 3, 'months').diff(dayjs(record.createdAt)) <= 0;
      if (isClaimInPeriod && record.status === ClaimState.INIT) {
        shareProfitCandidates[record.userId] = 0;
        shareProfitCandidatesIds.push(record.userId);
      } else if (record.status === ClaimState.INIT) {
        profitExpiredCandidatesIds.push(record.userId);
      }
    }
    if (profitExpiredCandidatesIds.length > 0) {
      await getConnection()
        .createQueryBuilder()
        .update(ClaimBooking)
        .set({ status: ClaimState.EXPIRED })
        .where({ userId: In(profitExpiredCandidatesIds) })
        .execute();
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
    // get a connection and create a new query runner
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    // establish real database connection using our new query runner
    await queryRunner.connect();
    // lets now open a new transaction:
    await queryRunner.startTransaction();
    try {
      const totalNeedShareProfit = await this._updateUserCashFlowAndBalance(shareProfitCandidates);
      // check if company needs to share profit
      if (totalNeedShareProfit.toNumber() <= 0) {
        // commit transaction now
        await queryRunner.commitTransaction();
        // you need to release query runner which is manually created
        await queryRunner.release();
        return;
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

      // commit transaction now
      await queryRunner.commitTransaction();
    } catch (err) {
      // since we have errors let's rollback changes we made
      await queryRunner.rollbackTransaction();
    } finally {
      // you need to release query runner which is manually created
      await queryRunner.release();
    }
  }

  private async _updateUserCashFlowAndBalance(shareProfitCandidates: Map<string, BigNumber>): Promise<BigNumber> {
    // get a connection and create a new query runner
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    // establish real database connection using our new query runner
    await queryRunner.connect();
    // lets now open a new transaction:
    await queryRunner.startTransaction();
    let totalNeedShareProfit = new BigNumber(0);
    try {
      // execute some operations on this transaction:
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
        const claimBooking = await queryRunner.manager.getRepository(ClaimBooking).findOne({ userId: key });
        claimBooking.status = ClaimState.FINISH;
        await queryRunner.manager.getRepository(ClaimBooking).save(claimBooking);
      }
      // commit transaction now:
      await queryRunner.commitTransaction();
    } catch (e) {
      // since we have errors let's rollback changes we made
      await queryRunner.rollbackTransaction();
    } finally {
      // you need to release query runner which is manually created:
      await queryRunner.release();
    }
    return totalNeedShareProfit;
  }

  public async allocateFund(): Promise<void> {
    const currentSeason = await this._getCurrentSeason();
  }

  private _getCurrentSeason(): number {
    return dayjs().quarter();
  }
}