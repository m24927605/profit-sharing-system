import BigNumber from 'bignumber.js';
import { Response } from 'express';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import {
  SharedProfit,
  SharedProfitDto
} from '../dto/shared-profit';
import { ResponseType } from './base/response';
import { InvestmentService } from '../service/investment';
import { UtilController } from '../util/controller';


@Controller('/company')
export class CompanyController {
  constructor(
    private readonly _investmentService: InvestmentService
  ) {
  }

  @Post('/shared-profit')
  public async addProfit(@Body() sharedProfitDto: SharedProfitDto, @Res() res: Response): Promise<void> {
    try {
      const sharedProfit = new SharedProfit();
      sharedProfit.income = new BigNumber(sharedProfitDto.income).toNumber();
      sharedProfit.outcome = new BigNumber(sharedProfitDto.outcome).toNumber();
      await this._investmentService.addProfit(sharedProfit);
      const passResponse = UtilController.passHandler('add shared profit successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}