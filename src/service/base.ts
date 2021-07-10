import dayjs from 'dayjs';

import { Repository } from 'typeorm';
import BigNumber from 'bignumber.js';

export class RepositoryService {
  /**
   * Insert data there is no data or update data.
   * @param repository database repository
   * @param entity database entity
   */
  public static async insertOrUpdate<T, K>(repository: Repository<T>, entity: K): Promise<void> {
    await repository.save(entity);
  }
}

export class TimeService {
  /**
   * Get the season by date.
   * @param date
   */
  public static getSeason(date?: string | number | Date | dayjs.Dayjs) {
    return dayjs(date).quarter();
  }

  /**
   * Get the date range in a specific season by date
   * @param date
   */
  public static getSeasonDateRange(date: Date) {
    return new Map([
      [1, { fromAt: `${dayjs(date).year()}-01-01`, toAt: `${dayjs(date).year()}-03-31` }],
      [2, { fromAt: `${dayjs(date).year()}-04-01`, toAt: `${dayjs(date).year()}-06-30` }],
      [3, { fromAt: `${dayjs(date).year()}-07-01`, toAt: `${dayjs(date).year()}-09-30` }],
      [4, { fromAt: `${dayjs(date).year()}-10-01`, toAt: `${dayjs(date).year()}-12-31` }]
    ]);
  };

  public static isInTimePeriod(nowDate, fromAt, toAt): boolean {
    const isBeforeToAt = dayjs(toAt).unix() - dayjs(nowDate).unix() >= 0;
    const isAfterFromAt = dayjs(nowDate).unix() - dayjs(fromAt).unix() >= 0;
    return isAfterFromAt && isBeforeToAt;
  }
}

export class Amount {
  _initBalanceAmount?: number = 0;
  _balanceAmount?: number;
  depositAmount?: number = 0;
  withdrawAmount?: number = 0;

  public get initBalanceAmount(): number {
    return this._initBalanceAmount;
  }

  public set initBalanceAmount(balanceAmount: number) {
    this._initBalanceAmount = balanceAmount;
  }

  public get balanceAmount(): number {
    this._balanceAmount = new BigNumber(this._initBalanceAmount)
      .plus(new BigNumber(this.depositAmount))
      .minus(new BigNumber(this.withdrawAmount))
      .toNumber();
    return this._balanceAmount;
  }

  public get isWithdrawAmountLessThanBalance() {
    return new BigNumber(this.withdrawAmount).isGreaterThan(new BigNumber(this.balanceAmount));
  }
}