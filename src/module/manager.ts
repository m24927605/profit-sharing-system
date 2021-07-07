import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ManagerController } from '../controller/manager';
import { ManagerService } from '../service/manager';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({ secret: process.env.JWT_SECRET })
  ],
  controllers: [
    ManagerController
  ],
  providers: [
    ManagerService
  ],
})
export class ManagerModule {
}