import { Response } from 'express';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import { CreateUserDto } from '../dto/user';
import { ResponseType } from './base/response';
import { UtilController } from '../util/controller';
import { UserService } from '../service/user';

@Controller('/users')
export class UserController {
  constructor(protected readonly _userService: UserService) {
  }

  @Post()
  public async create(@Body() createUserDto: CreateUserDto, @Res() res: Response): Promise<void> {
    try {
      await this._userService.create(createUserDto);
      const passResponse = UtilController.passHandler('create user successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Get()
  public async list(@Res() res: Response): Promise<void> {
    try {
      const users = await this._userService.list();
      const passResponse = UtilController.passHandler('get users successfully.', users);
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}