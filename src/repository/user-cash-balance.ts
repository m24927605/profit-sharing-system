import { getRepository } from 'typeorm';

import { UserCashBalance } from '../entity/user-cash-balance';

export class UserCashBalanceRepository {
  public async create(userCashBalance: UserCashBalance): Promise<void> {
    await getRepository(UserCashBalance).insert(userCashBalance);
  }

  public async getOne<T>(condition: T): Promise<UserCashBalance> {
    return await getRepository(UserCashBalance).findOne(condition);
  }

  public async update(condition: Partial<UserCashBalance>, userCashBalance: UserCashBalance) {
    await getRepository(UserCashBalance).update(condition, userCashBalance);
  }

  public async updateForWithdraw(withDrawAmount: number, userCashBalance: UserCashBalance) {
    await getRepository(UserCashBalance).createQueryBuilder().update(UserCashBalance)
      .set(userCashBalance)
      // To avoid phantom READ,balance - withdraw >= 0
      .where('balance - :withdraw >= 0 AND userId = :userId', {
        withdraw: withDrawAmount,
        userId: userCashBalance.userId
      })
      .execute();
  }
}