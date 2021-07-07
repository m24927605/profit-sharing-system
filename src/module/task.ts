import { Module } from '@nestjs/common';
import { InvestmentModule } from './investment';
import { InvestmentService } from '../service/investment';
import { CronTaskService } from '../service/cron-task';

@Module({
  imports: [
    InvestmentModule
  ],
  providers: [InvestmentService, CronTaskService]
})
export class TaskModule {
}