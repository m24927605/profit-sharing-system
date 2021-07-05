import {
  NextFunction,
  Request,
  Response
} from 'express';
import {
  HttpStatus,
  Injectable,
  NestMiddleware
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResponseType } from '../controller/base/response';
import { UtilController } from '../util/controller';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly _jwtService: JwtService) {
  }

  public async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.token as string;
    if (!token) {
      UtilController.errorHandler(HttpStatus.BAD_REQUEST, ResponseType.ERROR, 'token is required.');
    }
    try{
      await this._jwtService.verifyAsync(token);
      next();
    }catch (e) {
      UtilController.errorHandler(HttpStatus.FORBIDDEN, ResponseType.ERROR, 'token is invalid.');
    }
  }
}
