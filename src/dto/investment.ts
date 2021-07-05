import {
  IsNotEmpty,
  IsString
} from 'class-validator';

export class ClaimDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}