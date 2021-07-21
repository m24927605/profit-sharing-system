import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClaimBooking } from '../entity/claim-booking';
import { ClaimBookingRepository } from '../repository/claim-booking';
import { CompanySharedProfitBalance } from '../entity/company-shared-profit-balance';
import { CompanySharedProfitFlow } from '../entity/company-shared-profit-flow';
import { CompanyProfitBalanceRepository } from '../repository/company-shared-profit-balance';
import { CompanyProfitFlowRepository } from '../repository/company-shared-profit-flow';
import { InvestmentController } from '../controller/investment';
import { InvestmentService } from '../service/investment';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashBalanceRepository } from '../repository/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';
import { UserCashFlowRepository } from '../repository/user-cash-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import { UserSharesBalanceRepository } from '../repository/user-shares-balance';
import { UserSharesFlowRepository } from '../repository/user-shares-flow';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      ClaimBooking,
      CompanySharedProfitBalance,
      CompanySharedProfitFlow,
      UserCashBalance,
      UserCashFlow,
      UserSharesBalance,
      UserSharesFlow
    ])
  ],
  controllers: [
    InvestmentController
  ],
  providers: [
    ClaimBookingRepository,
    CompanyProfitBalanceRepository,
    CompanyProfitFlowRepository,
    InvestmentService,
    UserCashBalanceRepository,
    UserCashFlowRepository,
    UserSharesBalanceRepository,
    UserSharesFlowRepository
  ],
  exports:[InvestmentService]
})
export class InvestmentModule {
}