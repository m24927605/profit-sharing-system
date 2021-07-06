import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'typeorm';
import { ClaimBooking } from '../entity/claim-booking';
import { ClaimState } from '../util/state';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly _maxClaimableSeason = Number(process.env.MAX_CLAIM_SEASON);

  /*
  * * * * * *
  | | | | | |
  | | | | | day of week
  | | | | month
  | | | day of month
  | | hour
  | minute
  second (optional)
  * */
  @Cron('* * * * 1 *')
  public async handleCron(): Promise<void> {
  }

  private async _caculateTotalSharedProfit(): Promise<void> {

  }
}