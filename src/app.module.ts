import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ManagerController } from './controller/manager';
import { ManagerService } from './service/manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user';


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
      entities: [User],
      synchronize: true
    })
  ],
  controllers: [ManagerController],
  providers: [ManagerService]
})

export class AppModule {
}
