import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ManagerController } from './controller/manager';
import { UserController } from './controller/user';
import { CompanyCashFlow } from './entity/company-cash-flow';
import { CompanyProfitBalance } from './entity/company_profit_balance';
import { Manager } from './entity/manager';
import { User } from './entity/user';
import { UserCashBalance } from './entity/user-cash-balance';
import { UserCashFlow } from './entity/user-cash-flow';
import { UserSharesBalance } from './entity/user-shares-balance';
import { UserSharesFlow } from './entity/user-shares-flow';
import { AuthMiddleware } from './middleware/auth';
import { ManagerService } from './service/manager';
import { UserService } from './service/user';


@Module({
  imports: [
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
        CompanyCashFlow,
        CompanyProfitBalance,
        Manager,
        User,
        UserCashBalance,
        UserCashFlow,
        UserSharesBalance,
        UserSharesFlow
      ],
      synchronize: true
    })
  ],
  controllers: [
    ManagerController,
    UserController
  ],
  providers: [
    ManagerService,
    UserService
  ]
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'managers/login', method: RequestMethod.POST }
      )
      .forRoutes(ManagerController);
    consumer
      .apply(AuthMiddleware)
      .forRoutes(UserController);

  }
}
