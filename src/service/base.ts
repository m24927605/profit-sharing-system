import { Repository } from 'typeorm';

export class RepositoryService {
  public static async insertOrUpdate<T, K>(repository: Repository<T>, entity: K): Promise<void> {
    await repository.save(entity);
  }
}