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
import { AuthMiddleware } from './middleware/auth';
import { InvestmentModule } from './module/investment';
import { ManagerModule } from './module/manager';
import { TaskModule } from './module/task';
import { UserModule } from './module/user';


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
      entities: [__dirname + '/entity/*.{ts,js}'],
      //synchronize: true,
      logging: ['query', 'error']
    }),
    InvestmentModule,
    ManagerModule,
    TaskModule,
    UserModule
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
