import { EntityManager, getRepository } from 'typeorm';
import {
  CompanySharedProfitBalance as ComProfitBalance
} from '../entity/company-shared-profit-balance';

export class CompanyProfitBalanceRepository {
  public async createOrUpdate(comProfitBalance: ComProfitBalance, sql: EntityManager): Promise<void> {
    await sql.getRepository(ComProfitBalance).save(comProfitBalance);
  }

  public async getOne<T>(condition: T): Promise<ComProfitBalance> {
    return await getRepository(ComProfitBalance).findOne(condition);
  }

  public async updateOutcome(companyId: number, outcome: number, profitBalance: ComProfitBalance) {
    await getRepository(ComProfitBalance).createQueryBuilder().update(ComProfitBalance)
      .set(profitBalance)
      // To avoid phantom READ,balance - outcome >= 0
      .where('balance - :outcome >= 0 AND id = :id', {
        outcome,
        id: companyId
      })
      .execute();
  }
}