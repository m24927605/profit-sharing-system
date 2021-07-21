import dayjs from 'dayjs';
import BigNumber from 'bignumber.js';

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
  private _balanceAmount?: number;

  public constructor(
    private readonly initBalanceAmount: number = 0,
    private readonly depositAmount: number = 0,
    private readonly withdrawAmount: number = 0
  ) {
    this._calculateBalanceAmount();
  }

  public get balanceAmount(): number {
    return this._balanceAmount;
  }

  public get isWithdrawAmountLessThanBalance() {
    return new BigNumber(this.withdrawAmount).isGreaterThan(new BigNumber(this.initBalanceAmount));
  }


  private _calculateBalanceAmount() {
    this._balanceAmount = new BigNumber(this.initBalanceAmount)
      .plus(new BigNumber(this.depositAmount))
      .minus(new BigNumber(this.withdrawAmount))
      .toNumber();
  }
}