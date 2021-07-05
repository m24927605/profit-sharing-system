import { Response } from 'express';
import {
  Body,
  Controller, HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import { ClaimDto } from '../dto/investment';
import { Handler } from '../util/handler';
import { InvestmentService } from '../service/investment';

import {
  ResponseType
} from './base/response';

@Controller('/investment')
export class InvestmentController{
  constructor(private readonly _investmentService: InvestmentService) {
  }

  @Post('/claim')
  public async claim(@Body() claimDto: ClaimDto, @Res() res: Response): Promise<void> {
    try {
      await this._investmentService.claim(claimDto);
      const passResponse = Handler.passHandler('claim successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await Handler.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}