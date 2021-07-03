import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ManagerController } from './controller/manager';
import { ManagerService } from './service/manager';
import { CompanyCashFlow } from './entity/company-cash-flow';
import { CompanyProfitBalance } from './entity/company_profit_balance';
import { Manager } from './entity/manager';
import { User } from './entity/user';
import { UserCashBalance } from './entity/user-cash-balance';
import { UserCashFlow } from './entity/user-cash-flow';
import { UserSharesBalance } from './entity/user-shares-balance';
import { UserSharesFlow } from './entity/user-shares-flow';


@Module({
  imports: [
    ConfigModule.forRoot(),
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
  controllers: [ManagerController],
  providers: [ManagerService]
})

export class AppModule {
}
