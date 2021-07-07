import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from '@nestjs/common';

import { AuthMiddleware } from './middleware/auth';
import { InvestmentModule } from './module/investment';
import { ManagerModule } from './module/manager';
import { UserModule } from './module/user';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Manager } from './entity/manager';
import { User } from './entity/user';
import { ClaimBooking } from './entity/claim-booking';
import { CompanySharedProfitBalance } from './entity/company-shared-profit-balance';
import { CompanySharedProfitFlow } from './entity/company-shared-profit-flow';
import { UserCashBalance } from './entity/user-cash-balance';
import { UserCashFlow } from './entity/user-cash-flow';
import { UserSharesBalance } from './entity/user-shares-balance';
import { UserSharesFlow } from './entity/user-shares-flow';
import { TaskModule } from './module/task';
import { ScheduleModule } from '@nestjs/schedule';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [
        ClaimBooking,
        CompanySharedProfitBalance,
        CompanySharedProfitFlow,
        Manager,
        User,
        UserCashBalance,
        UserCashFlow,
        UserSharesBalance,
        UserSharesFlow,
      ],
      synchronize: true,
      logging: true
    }),
    InvestmentModule,
    ManagerModule,
    TaskModule,
    UserModule,
  ]
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: '/api/v1/managers', method: RequestMethod.POST },
        { path: '/api/v1/managers/login', method: RequestMethod.POST }
      )
      .forRoutes('*');

  }
}
