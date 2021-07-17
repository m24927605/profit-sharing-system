import { getRepository } from 'typeorm';
import { ClaimBooking } from '../entity/claim-booking';

export class ClaimBookingRepository {
  public async createOrUpdate(claimBooking: ClaimBooking): Promise<void> {
    await getRepository(ClaimBooking).save(claimBooking);
  }

  public async list<T>(condition?: T): Promise<ClaimBooking[]> {
    return await getRepository(ClaimBooking).find(condition);
  }

  public async getOne<T>(condition: T): Promise<ClaimBooking> {
    return await getRepository(ClaimBooking).findOneOrFail(condition);
  }

  public async update(condition: Partial<ClaimBooking>, claimBooking: ClaimBooking) {
    await getRepository(ClaimBooking).update(condition, claimBooking);
  }
}