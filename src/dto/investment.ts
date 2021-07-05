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
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}

export class ClaimBooking {
  id: string;
  userId: string;
}

export class UserShares {
  id: string;
  userId: string;
  invest: string;
  withdraw: string;
}