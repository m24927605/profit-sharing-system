import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UserController } from '../controller/user';
import { UserRepository } from '../repository/user';
import { UserService } from '../service/user';

@Module({
  imports: [
    ConfigModule.forRoot()
  ],
  controllers: [
    UserController
  ],
  providers: [
    UserRepository,
    UserService
  ]
})
export class UserModule {
}