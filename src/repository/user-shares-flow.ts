import {
  EntityManager,
  getRepository
} from 'typeorm';
import { UserSharesFlow } from '../entity/user-shares-flow';

export class UserSharesFlowRepository {
  public async create(userSharesFlow: UserSharesFlow, sql?: EntityManager): Promise<void> {
    if (!sql) {
      getRepository(UserSharesFlow).insert(userSharesFlow);
      return;
    }
    await sql.getRepository(UserSharesFlow).insert(userSharesFlow);
  }

  public async list<T>(condition?: T): Promise<UserSharesFlow[]> {
    return await getRepository(UserSharesFlow).find(condition);
  }
}