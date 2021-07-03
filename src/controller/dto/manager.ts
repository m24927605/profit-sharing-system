import {
  IsEmail,
  IsNotEmpty,
  IsString
} from 'class-validator';

export class CreateManagerDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsString()
  name: string;
}