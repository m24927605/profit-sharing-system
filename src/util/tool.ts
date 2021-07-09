import BigNumber from 'bignumber.js';

export class MathService {
  public static minus(minuendNumber: number, subtrahendNumber: number): BigNumber {
    return new BigNumber(minuendNumber).minus(subtrahendNumber);
  }

  public static plus(augendNumber: number, addendNumber): BigNumber {
    return new BigNumber(augendNumber).plus(addendNumber);
  }
}

