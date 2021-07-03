import { Test, TestingModule } from '@nestjs/testing';
import { ManagerController } from './manager';
import { ManagerService } from '../service/manager';

describe('AppController', () => {
  let managerController: ManagerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ManagerController],
      providers: [ManagerService],
    }).compile();

    managerController = app.get<ManagerController>(ManagerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
    });
  });
});
