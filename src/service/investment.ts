import BigNumber from 'bignumber.js';
import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { UtilService } from '../util/service';

import {
  ClaimDto,
  InvestDto,
  UserShares
} from '../dto/investment';
import { ClaimBooking } from '../entity/claim-booking';
import { UserSharesFlow } from '../entity/user-shares-flow';

@Injectable()
export class InvestmentService {

  public async invest(investDto: InvestDto): Promise<void> {
    const userShares = new UserShares();
    userShares.id = UtilService.genUniqueId();
    userShares.userId = investDto.userId;
    userShares.invest = new BigNumber(investDto.amount).toString();
    userShares.withdraw = new BigNumber(0).toString();
    const userSharesRepository = getRepository(UserSharesFlow);
    await userSharesRepository.save(userShares);
  }

  public async claim(claimDto: ClaimDto): Promise<void> {
    const claimBooking = new ClaimBooking();
    claimBooking.id = UtilService.genUniqueId();
    claimBooking.userId = claimDto.userId;
    const claimBookingRepository = getRepository(ClaimBooking);
    await claimBookingRepository.save(claimBooking);
  }

  public async withdraw(claimDto: ClaimDto): Promise<void> {
  }
}