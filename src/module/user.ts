import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserService } from '../service/user';
import { UserController } from '../controller/user';

@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  controllers: [
    UserController,
  ],
  providers: [
    UserService
  ],
})
export class UserModule {
}