import { Injectable } from '@nestjs/common';

@Injectable()
export class ManagerService {
  create(): string {
    return 'Hello World!';
  }
}
