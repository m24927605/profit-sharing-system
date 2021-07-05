import {
  IsNotEmpty,
  IsNumber,
  IsString
} from 'class-validator';

export class ClaimDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class InvestDto {
  @IsNumber()
  @IsNotEmpty()
  amount: string;
}

export class UserSharesFlowDto {
  invest: string;
  withdraw: string;
}