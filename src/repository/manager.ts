import { getRepository } from 'typeorm';
import { Manager } from '../entity/manager';

export class ManagerRepository {
  public async create(manager: Manager): Promise<void> {
    await getRepository(Manager).insert(manager);
  }

  public async getOne<T>(condition: T): Promise<Manager> {
    return await getRepository(Manager).findOneOrFail(condition);
  }
}