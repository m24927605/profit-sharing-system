import { mocked } from 'ts-jest/utils';
import typeorm, {
  Connection,
  getRepository,
  Repository
} from 'typeorm';
import { UniqueID } from 'nodejs-snowflake';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Test,
  TestingModule
} from '@nestjs/testing';
import { ClaimBooking } from '../../entity/claim-booking';
import {
  CompanySharedProfitBalance as ComProfitBalance
} from '../../entity/company-shared-profit-balance';
import {
  CompanySharedProfitFlow as ComProfitBalanceFlow
} from '../../entity/company-shared-profit-flow';
import { UserCashBalance } from '../../entity/user-cash-balance';
import { UserCashFlow } from '../../entity/user-cash-flow';
import { UserSharesBalance } from '../../entity/user-shares-balance';
import { UserSharesFlow } from '../../entity/user-shares-flow';
import { InvestOrDisInvestDto } from '../../dto/investment';
import { UtilService } from '../../util/service';
import { InvestmentService } from '../investment';

jest.mock('nodejs-snowflake');

describe('Test InvestmentService', () => {
  const mockId = 'mockId';
  let investmentService: InvestmentService;
  let utilServiceSpy;
  let claimBookingRepo: Repository<ClaimBooking>;
  let comProfitBalanceRepo: Repository<ComProfitBalance>;
  let comProfitBalanceFlowRepo: Repository<ComProfitBalanceFlow>;
  let userSharesFlowRepo: Repository<UserSharesFlow>;
  let userSharesBalanceRepo: Repository<UserSharesBalance>;
  let userCashFlowRepo: Repository<UserCashFlow>;
  let userCashBalanceRepo: Repository<UserCashBalance>;

  beforeEach(async () => {
    utilServiceSpy = jest.spyOn(UtilService, 'genUniqueId');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentService,
        UtilService,
        {
          provide: getRepositoryToken(ClaimBooking),
          useValue: {}
        },
        {
          provide: getRepositoryToken(ComProfitBalanceFlow),
          useValue: {}
        },
        {
          provide: getRepositoryToken(ComProfitBalance),
          useValue: {}
        },
        {
          provide: getRepositoryToken(UserSharesFlow),
          useValue: {
            insert: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(UserSharesBalance),
          useValue: {}
        },
        {
          provide: getRepositoryToken(UserCashFlow),
          useValue: {
            insert: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(UserCashBalance),
          useValue: {}
        }
      ]
    }).compile();
    investmentService = module.get<InvestmentService>(InvestmentService);
    claimBookingRepo = module.get<Repository<ClaimBooking>>(getRepositoryToken(ClaimBooking));
    comProfitBalanceRepo = module.get<Repository<ComProfitBalance>>(getRepositoryToken(ComProfitBalance));
    comProfitBalanceFlowRepo = module.get<Repository<ComProfitBalanceFlow>>(getRepositoryToken(ComProfitBalanceFlow));
    userSharesFlowRepo = module.get<Repository<UserSharesFlow>>(getRepositoryToken(UserSharesFlow));
    userSharesBalanceRepo = module.get<Repository<UserSharesBalance>>(getRepositoryToken(UserSharesBalance));
    userCashFlowRepo = module.get<Repository<UserCashFlow>>(getRepositoryToken(UserCashFlow));
    userCashBalanceRepo = module.get<Repository<UserCashBalance>>(getRepositoryToken(UserCashBalance));
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
    const investDto = new InvestOrDisInvestDto();
    await investmentService.invest(investDto);
    expect(userSharesFlowRepo.insert).toBeCalledTimes(1);
  });
});
