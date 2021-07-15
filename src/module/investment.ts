import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvestmentController } from '../controller/investment';
import { InvestmentService } from '../service/investment';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimBooking } from '../entity/claim-booking';
import { CompanySharedProfitBalance } from '../entity/company-shared-profit-balance';
import { CompanySharedProfitFlow } from '../entity/company-shared-profit-flow';
import { UserSharesBalance } from '../entity/user-shares-balance';
import { UserSharesFlow } from '../entity/user-shares-flow';
import { UserCashBalance } from '../entity/user-cash-balance';
import { UserCashFlow } from '../entity/user-cash-flow';

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
    InvestmentService
  ],
  exports:[InvestmentService]
})
export class InvestmentModule {
}