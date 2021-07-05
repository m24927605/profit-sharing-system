import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { CompanyShareProfitFlow } from '../entity/company-share-profit-flow';
import { SharedProfit } from '../dto/shared-profit';

@Injectable()
export class SharedProfitService {
  public async addProfit(sharedProfit: SharedProfit): Promise<void> {
    const shareProfitRepository = getRepository(CompanyShareProfitFlow);
    await shareProfitRepository.save(sharedProfit);
  }
}