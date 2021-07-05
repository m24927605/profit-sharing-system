import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponsePayload, ResponseType } from '../controller/base/response';

export class Handler{
  protected static async _errorHandler(status: HttpStatus, type: ResponseType, message: string): Promise<void> {
    const responsePayload = new ResponsePayload();
    responsePayload.status = status;
    responsePayload.type = type;
    responsePayload.message = message;
    throw new HttpException(responsePayload, responsePayload.status);
  }
}