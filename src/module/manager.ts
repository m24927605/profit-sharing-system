import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ManagerController } from '../controller/manager';
import { ManagerRepository } from '../repository/manager';
import { ManagerService } from '../service/manager';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({ secret: process.env.JWT_SECRET })
  ],
  controllers: [
    ManagerController
  ],
  providers: [
    ManagerRepository,
    ManagerService
  ]
})
export class ManagerModule {
}