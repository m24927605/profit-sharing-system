import {
  IsDecimal,
  IsNotEmpty,
  IsString,
  Validate
} from 'class-validator';
import { AmountRule } from '../service/validation';

export class ClaimDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class InvestOrDisInvestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsDecimal()
  @IsNotEmpty()
  @Validate(AmountRule)
  amount: string;
}

export class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsDecimal()
  @IsNotEmpty()
  @Validate(AmountRule)
  amount: string;
}

export class UserShares {
  id: string;
  userId: string;
  invest: string;
  disinvest: string;
}