import BigNumber from 'bignumber.js';

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

