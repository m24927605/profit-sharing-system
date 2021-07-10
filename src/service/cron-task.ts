import dayjs from 'dayjs';

import {
  Injectable
} from '@nestjs/common';
import {
  Cron
} from '@nestjs/schedule';

import { InvestmentService } from './investment';
import { TimeService } from './base';
import BigNumber from 'bignumber.js';

@Injectable()
export class CronTaskService {
  constructor(private readonly _investmentService: InvestmentService) {
  }

  // daily check if needs to settle or calculate user profit
  @Cron('* * 24 * * *')
  public async scheduledJob(): Promise<void> {
    const dateFormat = 'YYYY-MM-DD';
    const currentSeason = dayjs().quarter();
    let claimers: Map<string, BigNumber>;
    const seasonDateRange = TimeService.getSeasonDateRange(new Date());
    const { fromAt, toAt } = seasonDateRange.get(currentSeason);
    // settle user shares and calculate user profit at the end of season
    if (dayjs().format(dateFormat) === dayjs(toAt).format(dateFormat)) {
      await this._investmentService.settleUserShares(fromAt, toAt);
      // get qualified claimer
      const shareProfitClaimerIds = await this._investmentService.getQualifiedClaimers();
      // set not qualified claimer expired
      await this._investmentService.setNotQualifiedClaimersExpired();
      // get payable claimer list
      claimers = await this._investmentService.getPayableClaimers(shareProfitClaimerIds);
    }
    if (claimers) {
      // delay 1 day to pay to the user and the paid time will be in the next season
      const oneDayMs = 1000 * 60 * 60 * 24;
      await this._sleep(oneDayMs);
      // share profit to claimers
      await this._investmentService.shareProfit(claimers);
      claimers = null;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}