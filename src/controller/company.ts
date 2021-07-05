import { Response } from 'express';
import BigNumber from 'bignumber.js';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import { Handler } from '../util/handler';
import {
  SharedProfit,
  SharedProfitDto
} from '../dto/shared-profit';
import { SharedProfitService } from '../service/shared-profit';
import { ResponseType } from './base/response';

@Controller('/company')
export class CompanyController {
  constructor(private readonly _sharedProfitService: SharedProfitService) {
  }

  @Post('/shared-profit')
  public async addProfit(@Body() sharedProfitDto: SharedProfitDto, @Res() res: Response): Promise<void> {
    try {
      const sharedProfit = new SharedProfit();
      sharedProfit.income = new BigNumber(sharedProfitDto.income).toNumber();
      sharedProfit.outcome = new BigNumber(sharedProfitDto.outcome).toNumber();
      await this._sharedProfitService.addProfit(sharedProfit);
      const passResponse = Handler.passHandler('add shared profit successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await Handler.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}