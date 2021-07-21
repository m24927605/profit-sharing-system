import { Module } from '@nestjs/common';

import { CronTaskService } from '../service/cron-task';
import { InvestmentModule } from './investment';

@Module({
  imports: [
    InvestmentModule
  ],
  providers: [CronTaskService]
})
export class TaskModule {
}