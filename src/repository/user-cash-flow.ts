import { EntityManager } from 'typeorm';

import { UserCashFlow } from '../entity/user-cash-flow';

export class UserCashFlowRepository {
  public async create(userCashFlow: UserCashFlow, sql: EntityManager): Promise<void> {
    await sql.getRepository(UserCashFlow).insert(userCashFlow);
  }
}