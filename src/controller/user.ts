import { Response } from 'express';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import { CreateUserDto } from '../dto/user';
import { Handler } from '../util/handler';
import { UserService } from '../service/user';
import { ResponseType } from './base/response';


@Controller('/users')
export class UserController {

  constructor(protected readonly _userService: UserService) {
  }

  @Post()
  public async create(@Body() createUserDto: CreateUserDto, @Res() res: Response): Promise<void> {
    try {
      await this._userService.create(createUserDto);
      const passResponse = Handler.passHandler('create user successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      Handler.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}