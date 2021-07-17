import {
  compareSync,
  hashSync
} from 'bcrypt';
import { Injectable } from '@nestjs/common';

import { CreateManagerDto } from '../dto/manager';
import { Manager } from '../entity/manager';
import {
  ManagerRepository
} from '../repository/manager';

@Injectable()
export class ManagerService {
  private _saltOrRounds = 10;

  public constructor(private readonly _managerRepo: ManagerRepository) {
  }

  public async create(createManagerDto: CreateManagerDto): Promise<void> {
    const manager = new Manager();
    manager.email = createManagerDto.email;
    manager.name = createManagerDto.name;
    manager.password = hashSync(createManagerDto.password, this._saltOrRounds);
    await this._managerRepo.create(manager);
  }

  public async getManager(email: string): Promise<Manager> {
    return await this._managerRepo.getOne({ email });
  }

  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return compareSync(password, hashedPassword);
  }
}