import BigNumber from 'bignumber.js';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'CheckAmount', async: true })
@Injectable()
export class AmountRule implements ValidatorConstraintInterface {
  async validate(value: string) {
    return new BigNumber(value).isGreaterThanOrEqualTo(0);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must greater or equal to 0`;
  }
}