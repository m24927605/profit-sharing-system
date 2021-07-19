import {
  Repository
} from 'typeorm';
import { UniqueID } from 'nodejs-snowflake';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Test,
  TestingModule
} from '@nestjs/testing';
import { UserSharesBalance } from '../../entity/user-shares-balance';
import { ClaimBookingRepository } from '../../repository/claim-booking';
import { CompanyProfitBalanceRepository } from '../../repository/company-shared-profit-balance';
import { CompanyProfitFlowRepository } from '../../repository/company-shared-profit-flow';
import { UserCashBalanceRepository } from '../../repository/user-cash-balance';
import { UserCashFlowRepository } from '../../repository/user-cash-flow';
import { UserSharesBalanceRepository } from '../../repository/user-shares-balance';
import { UserSharesFlowRepository } from '../../repository/user-shares-flow';
import { InvestOrDisInvestDto } from '../../dto/investment';
import { UtilService } from '../../util/service';
import { InvestmentService } from '../investment';

jest.mock('nodejs-snowflake');

describe('Test InvestmentService', () => {
  const mockId = 'mockId';
  let investmentService: InvestmentService;
  let utilServiceSpy;
  let claimBookingRepo: ClaimBookingRepository;
  let comProfitBalanceRepo: CompanyProfitBalanceRepository;
  let comProfitBalanceFlowRepo: CompanyProfitFlowRepository;
  let userCashBalanceRepo: UserCashBalanceRepository;
  let userCashFlowRepo: UserCashFlowRepository;
  let userSharesBalanceRepo: UserSharesBalanceRepository;
  let userSharesFlowRepo: UserSharesFlowRepository;

  beforeEach(async () => {
    utilServiceSpy = jest.spyOn(UtilService, 'genUniqueId');
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
    comProfitBalanceFlowRepo = moduleRef.get<CompanyProfitFlowRepository>(CompanyProfitFlowRepository);
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
    const uniqueIDSpy = jest.spyOn(UniqueID.prototype, 'getUniqueID');
    uniqueIDSpy.mockReturnValue(mockId);
    const userId = '1';
    const amount = '100';
    const investDto = new InvestOrDisInvestDto();
    investDto.userId = userId;
    investDto.amount = amount;
    jest.spyOn(userSharesFlowRepo, 'create').mockResolvedValue(void 0);
    await investmentService.invest(investDto);
    expect(await userSharesFlowRepo.create).toBeCalledTimes(1);
    const mockUserShareFlow = {
      userId: userId,
      invest: amount,
      disinvest: '0',
      id: mockId
    };
    expect(await userSharesFlowRepo.create).toBeCalledWith(mockUserShareFlow, undefined);
  });
});
