import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { CompanySharedProfitFlow } from '../entity/company-shared-profit-flow';
import { SharedProfit } from '../dto/shared-profit';

@Injectable()
export class SharedProfitService {
  public async addProfit(sharedProfit: SharedProfit): Promise<void> {
    const shareProfitRepository = getRepository(CompanySharedProfitFlow);
    await shareProfitRepository.save(sharedProfit);
  }
}