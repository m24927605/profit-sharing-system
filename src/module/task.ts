import { Module } from '@nestjs/common';
import { InvestmentModule } from './investment';
import { CronTaskService } from '../service/cron-task';

@Module({
  imports: [
    InvestmentModule
  ],
  providers: [CronTaskService]
})
export class TaskModule {
}