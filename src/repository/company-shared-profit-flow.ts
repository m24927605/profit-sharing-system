import { EntityManager } from 'typeorm';

import {
  CompanySharedProfitFlow as ComProfitFlow
} from '../entity/company-shared-profit-flow';

export class CompanyProfitFlowRepository {
  public async create(comProfitFlow: ComProfitFlow, sql: EntityManager): Promise<void> {
    await sql.getRepository(ComProfitFlow).save(comProfitFlow);
  }
}