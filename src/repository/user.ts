import { getRepository } from 'typeorm';
import { User } from '../entity/user';

export class UserRepository {
  public async create(user: User) {
    await getRepository(User).insert(user);
  }

  public async list<T>(condition?: T): Promise<User[]> {
    return await getRepository(User).find(condition);
  }
}