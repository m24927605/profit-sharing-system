import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponsePayload, ResponseType } from '../controller/base/response';

export class Handler {
  public static passHandler<T>(message: string, data?: T): ResponsePayload<T> {
    const responsePayload = new ResponsePayload<T>();
    responsePayload.status = HttpStatus.OK;
    responsePayload.type = ResponseType.FINISH;
    responsePayload.message = message;
    responsePayload.data = data;
    return responsePayload;
  }

  public static errorHandler(status: HttpStatus, type: ResponseType, message: string): void {
    const responsePayload = new ResponsePayload();
    responsePayload.status = status;
    responsePayload.type = type;
    responsePayload.message = message;
    throw new HttpException(responsePayload, responsePayload.status);
  }
}