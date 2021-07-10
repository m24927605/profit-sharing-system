import {
  IsDecimal,
  IsNotEmpty,
  IsString
} from 'class-validator';

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
  amount: string;
}

export class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsDecimal()
  @IsNotEmpty()
  amount: string;
}

export class ClaimBooking {
  id: string;
  userId: string;
}

export class UserShares {
  id: string;
  userId: string;
  invest: string;
  disinvest: string;
}

export class UserSharesBalanceData {
  userId: string;
  balance: string;
}