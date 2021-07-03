import { HttpStatus } from '@nestjs/common';

export class ResponsePayload<T> {
  status: HttpStatus;
  type: ResponseType;
  message: string;
  data?: T;
}

export enum ResponseType {
  FINISH = 'finish',
  ERROR = 'error'
}