import {
  EntityManager,
  getRepository
} from 'typeorm';

import { UserSharesBalance } from '../entity/user-shares-balance';

export class UserSharesBalanceRepository {
  public async create(userSharesBalanceRows: UserSharesBalance[], sql: EntityManager): Promise<void> {
    if (sql) {
      await sql.getRepository(UserSharesBalance).insert(userSharesBalanceRows);
      return;
    }
    await getRepository(UserSharesBalance).insert(userSharesBalanceRows);
  }

  public async listByIds(ids: string[]): Promise<UserSharesBalance[]> {
    return await getRepository(UserSharesBalance).findByIds(ids);
  }

  public async delete(ids: string[], sql: EntityManager) {
    if (sql) {
      await sql.getRepository(UserSharesBalance).delete(ids);
      return;
    }
    await getRepository(UserSharesBalance).delete(ids);
  }
}