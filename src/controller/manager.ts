import {
  Controller
  , Post
} from '@nestjs/common';
import { ManagerService } from '../service/manager';

@Controller()
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {
  }

  @Post('/manager')
  create(): string {
    return this.managerService.create();
  }
}
