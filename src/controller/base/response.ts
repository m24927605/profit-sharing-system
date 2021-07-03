import { HttpStatus } from '@nestjs/common';

export class ResponsePayload {
  status: HttpStatus;
  type: ResponseType;
  message: string;
}

export enum ResponseType {
  FINISH = 'finish',
  ERROR = 'error'
}