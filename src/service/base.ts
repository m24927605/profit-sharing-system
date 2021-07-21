import BigNumber from 'bignumber.js';

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