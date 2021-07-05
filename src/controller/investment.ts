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
  ClaimDto,
  InvestDto,
  WithdrawDto
} from '../dto/investment';
import { UtilController } from '../util/controller';
import { InvestmentService } from '../service/investment';

import { ResponseType } from './base/response';

@Controller('/investment')
export class InvestmentController {
  constructor(private readonly _investmentService: InvestmentService) {
  }

  @Post('/invest')
  public async invest(@Body() investDto: InvestDto, @Res() res: Response): Promise<void> {
    try {

      await this._investmentService.invest(investDto);
      const passResponse = UtilController.passHandler('invest successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Post('/claim')
  public async claim(@Body() claimDto: ClaimDto, @Res() res: Response): Promise<void> {
    try {
      await this._investmentService.claim(claimDto);
      const passResponse = UtilController.passHandler('claim successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Post('/withdraw')
  public async withdraw(@Body() withdrawDto: WithdrawDto, @Res() res: Response): Promise<void> {
    try {
      await this._investmentService.withdraw(withdrawDto);
      const passResponse = UtilController.passHandler('withdraw successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}