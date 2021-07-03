import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post
} from '@nestjs/common';

import { ManagerService } from '../service/manager';
import { CreateManagerDto } from './dto/manager';
import {
  ResponsePayload,
  ResponseType
} from './base/response';

@Controller('/manager')
export class ManagerController {
  constructor(private readonly _managerService: ManagerService) {
  }

  @Post('')
  public async create(@Body() createManagerDto: CreateManagerDto): Promise<ResponsePayload> {
    try {
      await this._managerService.create(createManagerDto);
      const responsePayload = new ResponsePayload();
      responsePayload.status = HttpStatus.OK;
      responsePayload.type = ResponseType.FINISH;
      responsePayload.message = 'create manager successfully.';
      return responsePayload;
    } catch (e) {
      const responsePayload = new ResponsePayload();
      responsePayload.status = HttpStatus.EXPECTATION_FAILED;
      responsePayload.type = ResponseType.FINISH;
      responsePayload.message = e.message;
      throw new HttpException(responsePayload, responsePayload.status);
    }
  }
}
