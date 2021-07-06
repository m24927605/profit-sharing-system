import { Response } from 'express';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res
} from '@nestjs/common';

import { ClaimDto, InvestDto, WithdrawDto } from '../dto/investment';
import { UtilController } from '../util/controller';
import { InvestmentService } from '../service/investment';

import { ResponseType } from './base/response';
import { seasonMap } from '../util/season';

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

  //for develop testing
  @Post('/company-settle')
  public async recordSharedProfitBalance(@Body() { season }: any, @Res() res: Response): Promise<void> {
    try {
      const { fromAt, toAt } = seasonMap.get(season);
      await this._investmentService.recordSharedProfitBalance(fromAt, toAt);
      const passResponse = UtilController.passHandler('company settle successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  //for develop testing
  @Post('/user-settle')
  public async recordUserSharesBalance(@Body() { season }: any, @Res() res: Response): Promise<void> {
    try {
      const { fromAt, toAt } = seasonMap.get(season);
      await this._investmentService.recordUserSharesBalance(fromAt, toAt);
      const passResponse = UtilController.passHandler('user settle successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  ///for develop testing
  @Post('/calculate-user-profit')
  public async calculateUserGainProfit(@Body() body: any, @Res() res: Response): Promise<void> {
    try {
      const data = await this._investmentService.calculateUserGainProfit();
      const responsseJsonData = {};
      for (const [key, value] of Object.entries(data)) {
        responsseJsonData[key] = value.toNumber();
      }
      const passResponse = UtilController.passHandler('calculate user profit successfully.', responsseJsonData);
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  //for develop testing
  @Post('/share-profit')
  public async doShareProfit(@Body() body: any, @Res() res: Response): Promise<void> {
    try {
      const result = await this._investmentService.calculateUserGainProfit();
      console.log(['[result]', result]);
      await this._investmentService.doShareProfit(result);
      const passResponse = UtilController.passHandler('share profit successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}