import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { CreateUserDto } from '../dto/user';
import { User } from '../entity/user';
import { UtilService } from '../util/service';

@Injectable()
export class UserService {
  public async create(createUserDto: CreateUserDto): Promise<void> {
    const newUser = new User();
    newUser.id = UtilService.genUniqueId();
    newUser.name = createUserDto.name;
    const userRepository = getRepository(User);
    await userRepository.save(newUser);
  }

  public async list(): Promise<User[]> {
    const userRepository = getRepository(User);
    return await userRepository.find();
  }
}