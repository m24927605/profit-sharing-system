import { Response } from 'express';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';
import { Handler } from '../util/handler';
import { UserService } from '../service/user';
import {
  ResponsePayload,
  ResponseType
} from './base/response';
import { CreateUserDto } from './dto/user';

@Controller('/users')
export class UserController extends Handler {

  constructor(protected readonly _userService: UserService) {
    super();
  }

  @Post()
  public async create(@Body() createUserDto: CreateUserDto, @Res() res: Response): Promise<void> {
    try {
      await this._userService.create(createUserDto);
      const responsePayload = new ResponsePayload();
      responsePayload.status = HttpStatus.OK;
      responsePayload.type = ResponseType.FINISH;
      responsePayload.message = 'create user successfully.';
      res.status(responsePayload.status).json(responsePayload);
    } catch (e) {
      await Handler._errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}