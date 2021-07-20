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
import { ClaimDto, InvestOrDisInvestDto } from '../../dto/investment';
import { UtilService } from '../../util/service';
import { InvestmentService } from '../investment';
import { UserSharesFlow } from '../../entity/user-shares-flow';
import { ClaimBooking } from '../../entity/claim-booking';
import { CompanySharedProfitFlow } from '../../entity/company-shared-profit-flow';
import { SharedProfitDto } from '../../dto/shared-profit';
import { CompanySharedProfitBalance } from '../../entity/company-shared-profit-balance';
import { ClaimState } from '../../util/state';

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
  it('claim success', async () => {
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
      { createAt: '2021-07-19 12:00:00' }
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
    jest.spyOn(comProfitBalanceRepo, 'getOne').mockResolvedValue({ balance: 0 } as unknown as CompanySharedProfitBalance);
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
  it('settle user shares fails,no need to share profit', async () => {
    jest.spyOn(userSharesFlowRepo, 'list').mockResolvedValue([] as UserSharesFlow[]);
    jest.spyOn(userSharesBalanceRepo, 'delete').mockResolvedValue(void 0);
    jest.spyOn(userSharesBalanceRepo, 'create').mockResolvedValue(void 0);
    await expect(investmentService.settleUserSharesTxHandler('2020-07-20 00:00:00', '2020-07-20 23:59:59', undefined))
      .rejects.toThrow(new Error('No need to share profit.'));
  });
});
