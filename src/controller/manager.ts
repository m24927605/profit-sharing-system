import { Response } from 'express';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  CreateManagerDto,
  ManagerLoginDto
} from '../dto/manager';
import { ManagerService } from '../service/manager';
import { Handler } from '../util/handler';
import {
  ResponsePayload,
  ResponseType
} from './base/response';

@Controller('/managers')
export class ManagerController {
  protected _expiresIn = 60 * 60 * 24;

  constructor(
    private readonly _managerService: ManagerService,
    private readonly _jwtService: JwtService
  ) {
  }

  @Post()
  public async create(@Body() createManagerDto: CreateManagerDto, @Res() res: Response): Promise<void> {
    try {
      await this._managerService.create(createManagerDto);
      const passResponse = Handler.passHandler('create manager successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      Handler.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Post('/login')
  public async login(@Body() managerLoginDto: ManagerLoginDto, @Res() res: Response): Promise<void> {
    try {
      const { email, password } = managerLoginDto;
      const manager = await this._managerService.getManager(email);
      const isPasswordValid = await this._managerService.comparePassword(password, manager.password);
      const responsePayload = new ResponsePayload<TokenData>();
      responsePayload.type = ResponseType.FINISH;
      if (isPasswordValid) {
        const token = await this._jwtService.sign({ email }, { expiresIn: this._expiresIn });
        responsePayload.status = HttpStatus.OK;
        responsePayload.message = 'manager logins successfully.';
        responsePayload.data = { token };
      } else {
        responsePayload.status = HttpStatus.UNAUTHORIZED;
        responsePayload.message = 'manager logins failed.';
      }
      res.status(responsePayload.status).json(responsePayload);
    } catch (e) {
      Handler.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}

type TokenData = {
  token: string;
}