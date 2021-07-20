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
  InvestOrDisInvestDto,
  WithdrawDto
} from '../dto/investment';
import {
  SharedProfit,
  SharedProfitDto
} from '../dto/shared-profit';
import { UtilController } from '../util/controller';
import { InvestmentService } from '../service/investment';
import { ResponseType } from './base/response';
import { TimeService } from '../service/base';


@Controller('/investment')
export class InvestmentController {
  constructor(private readonly _investmentService: InvestmentService) {
  }

  @Post('/invest')
  public async invest(@Body() investDto: InvestOrDisInvestDto, @Res() res: Response): Promise<void> {
    try {
      await this._investmentService.invest(investDto);
      const passResponse = UtilController.passHandler('invest successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Post('/disinvest')
  public async disinvest(@Body() disInvestDto: InvestOrDisInvestDto, @Res() res: Response): Promise<void> {
    try {
      await this._investmentService.disinvest(disInvestDto);
      const passResponse = UtilController.passHandler('disinvest successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  @Post('/add-profit')
  public async addProfit(@Body() sharedProfitDto: SharedProfitDto, @Res() res: Response): Promise<void> {
    try {
      const sharedProfit = new SharedProfit();
      sharedProfit.income = new BigNumber(sharedProfitDto.income).toNumber();
      sharedProfit.outcome = new BigNumber(sharedProfitDto.outcome).toNumber();
      await this._investmentService.addProfit(sharedProfitDto);
      const passResponse = UtilController.passHandler('add shared profit successfully.');
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

  //for developer testing
  @Post('/user-settle')
  public async recordUserSharesBalance(@Body() { season }: any, @Res() res: Response): Promise<void> {
    try {
      const seasonMap = TimeService.getSeasonDateRange(new Date());
      const { fromAt, toAt } = seasonMap.get(season);
      await this._investmentService.settleUserShares(fromAt, toAt);
      const passResponse = UtilController.passHandler('user settle successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }

  //for developer testing
  @Post('/share-profit')
  public async doShareProfit(@Body() body: any, @Res() res: Response): Promise<void> {
    try {
      const shareProfitCandidateIds = await this._investmentService.getQualifiedClaimers();
      await this._investmentService.setUnQualifiedClaimersExpired();
      const candidates = await this._investmentService.getPayableClaimers(shareProfitCandidateIds);
      await this._investmentService.shareProfit(candidates);
      const passResponse = UtilController.passHandler('share profit successfully.');
      res.status(passResponse.status).json(passResponse);
    } catch (e) {
      await UtilController.errorHandler(HttpStatus.EXPECTATION_FAILED, ResponseType.ERROR, e.message);
    }
  }
}