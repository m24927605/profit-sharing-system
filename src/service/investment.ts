import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { ClaimBooking } from '../entity/claim-booking';
import { ClaimDto } from '../dto/investment';

@Injectable()
export class InvestmentService {
  public async claim(claimDto: ClaimDto): Promise<void> {
    const claimBookingRepository = getRepository(ClaimBooking);
    await claimBookingRepository.save(claimDto);
  }
}