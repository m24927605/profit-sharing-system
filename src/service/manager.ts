import { hashSync, compareSync } from 'bcrypt';
import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { CreateManagerDto } from '../dto/manager';
import { Manager } from '../entity/manager';

@Injectable()
export class ManagerService {
  private _saltOrRounds = 10;

  public async create(createManagerDto: CreateManagerDto): Promise<void> {
    createManagerDto.password = hashSync(createManagerDto.password, this._saltOrRounds);
    const managerRepository = getRepository(Manager);
    await managerRepository.save(createManagerDto);
  }

  public async getManager(email: string): Promise<Manager> {
    const managerRepository = getRepository(Manager);
    return await managerRepository.findOneOrFail({ email });
  }

  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return compareSync(password,hashedPassword);
  }
}
