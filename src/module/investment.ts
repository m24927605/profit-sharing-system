import { Module } from '@nestjs/common';
import { InvestmentService } from '../service/investment';
import { ConfigModule } from '@nestjs/config';
import { InvestmentController } from '../controller/investment';

@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  controllers: [
    InvestmentController
  ],
  providers: [InvestmentService],
  exports:[InvestmentService]
})
export class InvestmentModule {
}