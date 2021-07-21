import {
  IsDecimal,
  IsNotEmpty,
  IsNumberString,
  Validate
} from 'class-validator';
import { AmountRule } from '../service/validation';

export class SharedProfitDto {
  @IsDecimal()
  @IsNumberString()
  @IsNotEmpty()
  @Validate(AmountRule)
  income: string;

  @IsDecimal()
  @IsNumberString()
  @IsNotEmpty()
  @Validate(AmountRule)
  outcome: string;
}


export class SharedProfit {
  income: number;
  outcome: number;
}