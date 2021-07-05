import {
  IsDecimal,
  IsNotEmpty, IsNumberString
} from 'class-validator';

export class SharedProfitDto {
  @IsDecimal()
  @IsNumberString()
  @IsNotEmpty()
  income: string;

  @IsDecimal()
  @IsNumberString()
  @IsNotEmpty()
  outcome: string;
}


export class SharedProfit {
  income: number;
  outcome: number;
}