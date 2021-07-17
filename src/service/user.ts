import { Injectable } from '@nestjs/common';

import { CreateUserDto } from '../dto/user';
import { User } from '../entity/user';
import { UtilService } from '../util/service';
import { UserRepository } from '../repository/user';

@Injectable()
export class UserService {
  public constructor(private readonly _userRepo: UserRepository) {
  }

  public async create(createUserDto: CreateUserDto): Promise<void> {
    const newUser = new User();
    newUser.id = UtilService.genUniqueId();
    newUser.name = createUserDto.name;
    await this._userRepo.create(newUser);
  }

  public async list(): Promise<User[]> {
    return await this._userRepo.list();
  }
}