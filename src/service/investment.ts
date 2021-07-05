import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import {
  ClaimDto,
  InvestDto,
  UserSharesFlowDto
} from '../dto/investment';
import { ClaimBooking } from '../entity/claim-booking';
import { UserSharesFlow } from '../entity/user-shares-flow';

@Injectable()
export class InvestmentService {

  public async invest(userSharesFlowDto: UserSharesFlowDto): Promise<void> {
    const userSharesRepository = getRepository(UserSharesFlow);
    await userSharesRepository.save(userSharesFlowDto);
  }

  public async claim(claimDto: ClaimDto): Promise<void> {
    const claimBookingRepository = getRepository(ClaimBooking);
    await claimBookingRepository.save(claimDto);
  }
}