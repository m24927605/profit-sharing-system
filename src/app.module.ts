import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ManagerController } from './controller/manager';
import { InvestmentController } from './controller/investment';
import { UserController } from './controller/user';
import { ClaimBooking } from './entity/claim-booking';
import { CompanySharedProfitBalance } from './entity/company-shared-profit-balance';
import { CompanySharedProfitFlow } from './entity/company-shared-profit-flow';
import { Manager } from './entity/manager';
import { User } from './entity/user';
import { UserCashBalance } from './entity/user-cash-balance';
import { UserCashFlow } from './entity/user-cash-flow';
import { UserSharesBalance } from './entity/user-shares-balance';
import { UserSharesFlow } from './entity/user-shares-flow';
import { AuthMiddleware } from './middleware/auth';
import { ManagerService } from './service/manager';
import { InvestmentService } from './service/investment';
import { UserService } from './service/user';


@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    ScheduleModule.forRoot(),
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
        UserSharesFlow
      ],
      synchronize: true,
      logging:true
    })
  ],
  controllers: [
    ManagerController,
    InvestmentController,
    UserController,
  ],
  providers: [
    ManagerService,
    InvestmentService,
    UserService
  ]
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: '/api/v1/managers/login', method: RequestMethod.POST }
      )
      .forRoutes('*');

  }
}
