import { UniqueID } from 'nodejs-snowflake';
import {
  Test,
  TestingModule
} from '@nestjs/testing';
import { ClaimBookingRepository } from '../../repository/claim-booking';
import { CompanyProfitBalanceRepository } from '../../repository/company-shared-profit-balance';
import { CompanyProfitFlowRepository } from '../../repository/company-shared-profit-flow';
import { UserCashBalanceRepository } from '../../repository/user-cash-balance';
import { UserCashFlowRepository } from '../../repository/user-cash-flow';
import { UserSharesBalanceRepository } from '../../repository/user-shares-balance';
import { UserSharesFlowRepository } from '../../repository/user-shares-flow';
import { ClaimDto, InvestOrDisInvestDto, WithdrawDto } from '../../dto/investment';
import { UtilService } from '../../util/service';
import { InvestmentService } from '../investment';
import { UserSharesFlow } from '../../entity/user-shares-flow';
import { ClaimBooking } from '../../entity/claim-booking';
import { CompanySharedProfitFlow } from '../../entity/company-shared-profit-flow';
import { SharedProfitDto } from '../../dto/shared-profit';
import { CompanySharedProfitBalance } from '../../entity/company-shared-profit-balance';
import { ClaimState } from '../../util/state';
import { UserCashBalance } from '../../entity/user-cash-balance';
import { UserSharesBalance } from '../../entity/user-shares-balance';
import BigNumber from 'bignumber.js';

jest.mock('nodejs-snowflake');
process.env.MAX_CLAIM_SEASON = '1';

describe('Test InvestmentService', () => {
  const mockId = 'mockId';
  let investmentService: InvestmentService;
  let claimBookingRepo: ClaimBookingRepository;
  let comProfitBalanceRepo: CompanyProfitBalanceRepository;
  let comProfitFlowRepo: CompanyProfitFlowRepository;
  let userCashBalanceRepo: UserCashBalanceRepository;
  let userCashFlowRepo: UserCashFlowRepository;
  let userSharesBalanceRepo: UserSharesBalanceRepository;
  let userSharesFlowRepo: UserSharesFlowRepository;

  beforeEach(async () => {
    jest.spyOn(UniqueID.prototype, 'getUniqueID').mockReturnValue(mockId);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentService,
        UtilService,
        ClaimBookingRepository,
        CompanyProfitBalanceRepository,
        CompanyProfitFlowRepository,
        UserCashBalanceRepository,
        UserCashFlowRepository,
        UserSharesBalanceRepository,
        UserSharesFlowRepository
      ]
    }).compile();
    investmentService = moduleRef.get<InvestmentService>(InvestmentService);
    claimBookingRepo = moduleRef.get<ClaimBookingRepository>(ClaimBookingRepository);
    comProfitBalanceRepo = moduleRef.get<CompanyProfitBalanceRepository>(CompanyProfitBalanceRepository);
    comProfitFlowRepo = moduleRef.get<CompanyProfitFlowRepository>(CompanyProfitFlowRepository);
    userCashBalanceRepo = moduleRef.get<UserCashBalanceRepository>(UserCashBalanceRepository);
    userCashFlowRepo = moduleRef.get<UserCashFlowRepository>(UserCashFlowRepository);
    userSharesBalanceRepo = moduleRef.get<UserSharesBalanceRepository>(UserSharesBalanceRepository);
    userSharesFlowRepo = moduleRef.get<UserSharesFlowRepository>(UserSharesFlowRepository);
  });

  afterEach(async () => {
    //await sqlSpy.mockRestore();
  });
  it('investmentService should be defined', () => {
    expect(investmentService).toBeDefined();
  });

  it('invest success', async () => {
    const userId = '1';
    const amount = '100';
    const investDto = new InvestOrDisInvestDto();
    investDto.userId = userId;
    investDto.amount = amount;
    jest.spyOn(userSharesFlowRepo, 'create').mockResolvedValue(void 0);
    await investmentService.invest(investDto);
    expect(userSharesFlowRepo.create).toBeCalledTimes(1);
    const mockUserShareFlow = {
      userId: userId,
      invest: amount,
      disinvest: '0',
      id: mockId
    };
    expect(await userSharesFlowRepo.create).toBeCalledWith(mockUserShareFlow, undefined);
  });
  it('disinvest success', async () => {
    const userId = '1';
    const amount = '100';
    const disinvestDto = new InvestOrDisInvestDto();
    disinvestDto.userId = userId;
    disinvestDto.amount = amount;
    jest.spyOn(userSharesFlowRepo, 'create').mockResolvedValue(void 0);
    const mockUserSharesFlowRecords = [
      {
        id: mockId,
        userId,
        invest: amount,
        disinvest: '0'
      },
      {
        id: mockId,
        userId,
        invest: '0',
        disinvest: '50'
      }
    ];
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue(mockUserSharesFlowRecords as UserSharesFlow[]);
    await investmentService.disinvestTxHandler(disinvestDto, undefined);
    expect(userSharesFlowRepo.create).toBeCalledTimes(1);
    const mockUserShareFlow = {
      userId: userId,
      invest: '0',
      disinvest: amount,
      id: mockId
    };
    expect(userSharesFlowRepo.create).toBeCalledWith(mockUserShareFlow, undefined);
  });
  it('disinvest fails,net shares balance should be positive', async () => {
    const userId = '1';
    const amount = '100';
    const disinvestDto = new InvestOrDisInvestDto();
    disinvestDto.userId = userId;
    disinvestDto.amount = amount;
    jest.spyOn(userSharesFlowRepo, 'create').mockResolvedValue(void 0);
    const mockUserSharesFlowRecords = [
      {
        id: mockId,
        userId,
        invest: amount,
        disinvest: '0'
      },
      {
        id: mockId,
        userId,
        invest: '0',
        disinvest: '150'
      }
    ];
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue(mockUserSharesFlowRecords as UserSharesFlow[]);
    await expect(investmentService.disinvestTxHandler(disinvestDto, undefined))
      .rejects.toThrow(new Error('User net shares cannot be less than 0'));
    expect(userSharesFlowRepo.create).toBeCalledTimes(1);
    const mockUserShareFlow = {
      userId: userId,
      invest: '0',
      disinvest: amount,
      id: mockId
    };
    expect(userSharesFlowRepo.create).toBeCalledWith(mockUserShareFlow, undefined);
  });
  it('claim success but has old record', async () => {
    const userId = '1';
    const mockClaimBookingRecords = [{ createAt: '2020-07-19 12:00:00', status: ClaimState.EXPIRED }];
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue(mockClaimBookingRecords as unknown as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'createOrUpdate').mockResolvedValue(void 0);
    const claimDto = new ClaimDto();
    claimDto.userId = userId;
    await investmentService.claim(claimDto);
    expect(claimBookingRepo.createOrUpdate).toBeCalledTimes(1);
    expect(claimBookingRepo.createOrUpdate).toBeCalledWith({ id: 'mockId', userId: '1' });
  });
  it('claim success but no record in claim booking table', async () => {
    const userId = '1';
    const mockClaimBookingRecords = [];
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue(mockClaimBookingRecords as unknown as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'createOrUpdate').mockResolvedValue(void 0);
    const claimDto = new ClaimDto();
    claimDto.userId = userId;
    await investmentService.claim(claimDto);
    expect(claimBookingRepo.createOrUpdate).toBeCalledTimes(1);
    expect(claimBookingRepo.createOrUpdate).toBeCalledWith({ id: 'mockId', userId: '1' });
  });
  it('claim fails,duplicated claiming', async () => {
    const userId = '1';
    const mockClaimBookingRecords = [
      { createAt: '2021-07-19 12:00:00', status: ClaimState.INIT }
    ];
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue(mockClaimBookingRecords as unknown as ClaimBooking[]);
    const claimDto = new ClaimDto();
    claimDto.userId = userId;
    await expect(investmentService.claim(claimDto))
      .rejects.toThrow(new Error('Cannot duplicated claim in the same season.'));
  });
  it('company add profit success', async () => {
    const sharedProfitDto = new SharedProfitDto();
    sharedProfitDto.income = '100';
    sharedProfitDto.outcome = '0';
    jest.spyOn(comProfitFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'createOrUpdate').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ balance: 0 } as CompanySharedProfitBalance);
    await investmentService.addProfitTxHandler(sharedProfitDto, undefined);
    expect(comProfitFlowRepo.create).toBeCalledTimes(1);
    const comSharedProfitFlow = new CompanySharedProfitFlow();
    comSharedProfitFlow.income = 100;
    comSharedProfitFlow.outcome = 0;
    expect(comProfitFlowRepo.create).toBeCalledWith(comSharedProfitFlow, undefined);
    const mockComProfitBalance = { id: 1, balance: 100 };
    expect(comProfitBalanceRepo.createOrUpdate).toBeCalledTimes(1);
    expect(comProfitBalanceRepo.createOrUpdate).toBeCalledWith(mockComProfitBalance, undefined);
  });
  it('company add profit success but no company profit balance record', async () => {
    const sharedProfitDto = new SharedProfitDto();
    sharedProfitDto.income = '100';
    sharedProfitDto.outcome = '0';
    jest.spyOn(comProfitFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'createOrUpdate').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue(void 0);
    await investmentService.addProfitTxHandler(sharedProfitDto, undefined);
    expect(comProfitFlowRepo.create).toBeCalledTimes(1);
    const comSharedProfitFlow = new CompanySharedProfitFlow();
    comSharedProfitFlow.income = 100;
    comSharedProfitFlow.outcome = 0;
    expect(comProfitFlowRepo.create).toBeCalledWith(comSharedProfitFlow, undefined);
    const mockComProfitBalance = { id: 1, balance: 100 };
    expect(comProfitBalanceRepo.createOrUpdate).toBeCalledTimes(1);
    expect(comProfitBalanceRepo.createOrUpdate).toBeCalledWith(mockComProfitBalance, undefined);
  });
  it('get unqualified claimer success', async () => {
    const userId = '1';
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue([
      {
        userId,
        createdAt: new Date(),
        status: ClaimState.INIT
      }
    ] as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    const qualifiedClaimers = await investmentService.getQualifiedClaimers();
    expect(claimBookingRepo.list).toBeCalledTimes(1);
    expect(qualifiedClaimers).toEqual([userId]);
  });
  it('get empty unqualified claimer', async () => {
    const userId = '1';
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue([
      {
        userId,
        createdAt: new Date(),
        status: ClaimState.EXPIRED
      }
    ] as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    const qualifiedClaimers = await investmentService.getQualifiedClaimers();
    expect(claimBookingRepo.list).toBeCalledTimes(1);
    expect(qualifiedClaimers).toEqual([]);
  });
  it('set unqualified claimer expired', async () => {
    const userId = '1';
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue([
      {
        userId,
        createdAt: new Date('2020-01-01'),
        status: ClaimState.INIT
      }
    ] as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    await investmentService.setUnQualifiedClaimersExpired();
    expect(claimBookingRepo.list).toBeCalledTimes(1);
    expect(claimBookingRepo.update).toBeCalledTimes(1);
  });
  it('not set unqualified claimer expired,status is not 0', async () => {
    const userId = '1';
    jest.spyOn(claimBookingRepo, 'list').mockResolvedValue([
      {
        userId,
        createdAt: new Date('2020-01-01'),
        status: ClaimState.EXPIRED
      }
    ] as ClaimBooking[]);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    await investmentService.setUnQualifiedClaimersExpired();
    expect(claimBookingRepo.list).toBeCalledTimes(1);
    expect(claimBookingRepo.update).toBeCalledTimes(0);
  });
  it('settle user shares', async () => {
    const userId = '1';
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue([
      {
        userId,
        invest: '100',
        disinvest: '0'
      }
    ] as UserSharesFlow[]);
    jest.spyOn(userSharesBalanceRepo, 'delete').mockResolvedValue(void 0);
    jest.spyOn(userSharesBalanceRepo, 'create').mockResolvedValue(void 0);
  });
  it('settle user shares success', async () => {
    const userId = '1';
    const fromAt = '2020-07-20 00:00:00';
    const toAt = '2020-07-20 23:59:59';
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue([
      {
        userId,
        invest: '100',
        disinvest: '0'
      }
    ] as UserSharesFlow[]);
    jest.spyOn(userSharesBalanceRepo, 'delete').mockResolvedValue(void 0);
    jest.spyOn(userSharesBalanceRepo, 'create').mockResolvedValue(void 0);
    await investmentService.settleUserSharesTxHandler(fromAt, toAt, undefined);
    expect(userSharesFlowRepo.list).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.delete).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.delete).toBeCalledWith([userId], undefined);
    expect(userSharesBalanceRepo.create).toBeCalledTimes(1);
  });
  it('settle user shares success with many records', async () => {
    const userId = '1';
    const fromAt = '2020-07-20 00:00:00';
    const toAt = '2020-07-20 23:59:59';
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue([
      {
        userId,
        invest: '100',
        disinvest: '0'
      },
      {
        userId,
        invest: '100',
        disinvest: '0'
      }
    ] as UserSharesFlow[]);
    jest.spyOn(userSharesBalanceRepo, 'delete').mockResolvedValue(void 0);
    jest.spyOn(userSharesBalanceRepo, 'create').mockResolvedValue(void 0);
    await investmentService.settleUserSharesTxHandler(fromAt, toAt, undefined);
    expect(userSharesFlowRepo.list).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.delete).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.delete).toBeCalledWith([userId], undefined);
    expect(userSharesBalanceRepo.create).toBeCalledTimes(1);
  });
  it('settle user shares fails,no need to share profit', async () => {
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue([] as UserSharesFlow[]);
    jest.spyOn(userSharesBalanceRepo, 'delete').mockResolvedValue(void 0);
    jest.spyOn(userSharesBalanceRepo, 'create').mockResolvedValue(void 0);
    await expect(investmentService.settleUserSharesTxHandler('2020-07-20 00:00:00', '2020-07-20 23:59:59', undefined))
      .rejects.toThrow(new Error('No need to share profit.'));
  });
  it('user withdraw success', async () => {
    const withdrawDto = new WithdrawDto();
    withdrawDto.userId = '1';
    withdrawDto.amount = '100';
    jest.spyOn(userCashBalanceRepo, 'getOne').mockResolvedValue({ balance: 100 } as UserCashBalance);
    jest.spyOn(userCashBalanceRepo, 'updateForWithdraw').mockResolvedValue(void 0);
    jest.spyOn(userCashFlowRepo, 'create').mockResolvedValue(void 0);
    await investmentService.withdrawTxHandler(withdrawDto, undefined);
    expect(userCashBalanceRepo.getOne).toBeCalledTimes(1);
    expect(userCashBalanceRepo.updateForWithdraw).toBeCalledTimes(1);
    expect(userCashFlowRepo.create).toBeCalledTimes(1);
  });
  it('user withdraw fails,user balance is 0', async () => {
    const withdrawDto = new WithdrawDto();
    withdrawDto.userId = '1';
    withdrawDto.amount = '100';
    jest.spyOn(userCashBalanceRepo, 'getOne').mockResolvedValue({ balance: 0 } as UserCashBalance);
    await expect(investmentService.withdrawTxHandler(withdrawDto, undefined))
      .rejects.toThrow(new Error('The balance of the user is 0.'));
  });
  it('user withdraw fails,withdraw amount is more than balance amount', async () => {
    const withdrawDto = new WithdrawDto();
    withdrawDto.userId = '1';
    withdrawDto.amount = '100';
    jest.spyOn(userCashBalanceRepo, 'getOne').mockResolvedValue({ balance: 1 } as UserCashBalance);
    jest.spyOn(userCashBalanceRepo, 'updateForWithdraw').mockResolvedValue(void 0);
    jest.spyOn(userCashFlowRepo, 'create').mockResolvedValue(void 0);
    await expect(investmentService.withdrawTxHandler(withdrawDto, undefined))
      .rejects.toThrow(new Error('Withdraw amount must less than balance.'));
    expect(userCashBalanceRepo.getOne).toBeCalledTimes(1);
    expect(userCashBalanceRepo.updateForWithdraw).toBeCalledTimes(0);
    expect(userCashFlowRepo.create).toBeCalledTimes(0);
  });
  it('get payable claimers success', async () => {
    const userId = '1';
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ balance: 100 } as CompanySharedProfitBalance);
    jest.spyOn(userSharesBalanceRepo, 'listByIds').mockResolvedValue([
      {
        userId,
        proportion: 100
      }
    ] as UserSharesBalance[]);
    const payableClaimers = await investmentService.getPayableClaimers([userId]);
    expect(payableClaimers.has(userId));
    expect(payableClaimers.get(userId).toNumber()).toEqual(100);
    expect(comProfitBalanceRepo.getOne).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.listByIds).toBeCalledTimes(1);
  });
  it('get payable claimers success but return empty map', async () => {
    const userId = '1';
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ balance: 100 } as CompanySharedProfitBalance);
    jest.spyOn(userSharesBalanceRepo, 'listByIds').mockResolvedValue([] as UserSharesBalance[]);
    const payableClaimers = await investmentService.getPayableClaimers([]);
    expect(payableClaimers.has(userId)).toBeFalsy();
    expect(comProfitBalanceRepo.getOne).toBeCalledTimes(1);
    expect(userSharesBalanceRepo.listByIds).toBeCalledTimes(1);
  });
  it('share profit success', async () => {
    const userId = '1';
    const payableClaimers = new Map([[userId, new BigNumber(100)]]);
    jest.spyOn(userCashFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'updateOutcome').mockResolvedValue(void 0);
    jest.spyOn(userCashBalanceRepo, 'getOne').mockResolvedValue(void 0);
    jest.spyOn(userCashBalanceRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(userCashBalanceRepo, 'update').mockResolvedValue(void 0);
    jest.spyOn(claimBookingRepo, 'getOne').mockResolvedValue({ status: ClaimState.INIT } as ClaimBooking);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ id: 1, balance: 100 } as CompanySharedProfitBalance);
    await investmentService.shareProfitTxHandler(payableClaimers, undefined);
    expect(userCashBalanceRepo.create).toBeCalledTimes(1);
    expect(userCashFlowRepo.create).toBeCalledTimes(1);
    expect(comProfitFlowRepo.create).toBeCalledTimes(1);
    expect(comProfitBalanceRepo.updateOutcome).toBeCalledTimes(1);
  });
  it('share profit success but has a record in user cash balance table', async () => {
    const userId = '1';
    const payableClaimers = new Map([[userId, new BigNumber(100)]]);
    jest.spyOn(userCashFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitFlowRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'updateOutcome').mockResolvedValue(void 0);
    jest.spyOn(userCashBalanceRepo, 'getOne').mockResolvedValue({ balance: 0 } as UserCashBalance);
    jest.spyOn(userCashBalanceRepo, 'create').mockResolvedValue(void 0);
    jest.spyOn(userCashBalanceRepo, 'update').mockResolvedValue(void 0);
    jest.spyOn(claimBookingRepo, 'getOne').mockResolvedValue({ status: ClaimState.INIT } as ClaimBooking);
    jest.spyOn(claimBookingRepo, 'update').mockResolvedValue(void 0);
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ id: 1, balance: 100 } as CompanySharedProfitBalance);
    await investmentService.shareProfitTxHandler(payableClaimers, undefined);
    expect(userCashBalanceRepo.create).toBeCalledTimes(0);
    expect(userCashFlowRepo.create).toBeCalledTimes(1);
    expect(comProfitFlowRepo.create).toBeCalledTimes(1);
    expect(comProfitBalanceRepo.updateOutcome).toBeCalledTimes(1);
  });
  it('share profit but no payable claimers', async () => {
    const payableClaimers = new Map();
    await expect(investmentService.shareProfitTxHandler(payableClaimers, undefined))
      .rejects.toThrow(new Error('No need to share profit.'));
  });
  it('share profit but the amount need to pay to payable claimers is 0', async () => {
    const userId = '1';
    const payableClaimers = new Map([[userId, new BigNumber(0)]]);
    await expect(investmentService.shareProfitTxHandler(payableClaimers, undefined))
      .rejects.toThrow(new Error('No need to share profit.'));
  });
});
