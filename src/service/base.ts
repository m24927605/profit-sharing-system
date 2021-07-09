import { Repository } from 'typeorm';

export class BaseService {
  public static async insertOrUpdate<T, K>(repository: Repository<T>, entity: K): Promise<void> {
    await repository.save(entity);
  }
}