import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import { UniqueID } from 'nodejs-snowflake';

export class UtilService{
  /**
   * Generate unique id.
   */
  public static genUniqueId(): string {
    return new UniqueID({ returnNumber: true }).getUniqueID().toString();
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

export class MathService {
  /**
   * Minus number on math.
   * @param minuendNumber this number needs to be subtracted
   * @param subtrahendNumber subtract with this number
   */
  public static minus(minuendNumber: number, subtrahendNumber: number): BigNumber {
    return new BigNumber(minuendNumber).minus(subtrahendNumber);
  }
  /**
   * Plus number on math.
   * @param minuendNumber This number needs to be added.
   * @param subtrahendNumber add with this number.
   */
  public static plus(augendNumber: number, addendNumber): BigNumber {
    return new BigNumber(augendNumber).plus(addendNumber);
  }
}

