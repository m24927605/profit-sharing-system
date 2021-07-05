import { UniqueID } from 'nodejs-snowflake';
import { getRepository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../controller/dto/user';
import { User } from '../entity/user';

@Injectable()
export class UserService {
  public async create(createUserDto: CreateUserDto): Promise<void> {
    const newUser = new User();
    newUser.id = new UniqueID({ returnNumber: true }).getUniqueID().toString();
    newUser.name = createUserDto.name;
    const userRepository = getRepository(User);
    await userRepository.save(newUser);
  }
}