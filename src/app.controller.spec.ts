import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationsGateway } from 'gateway/fireNotifications.gateway';

describe('AppController', () => {
  let appController: AppController;

  const mockNotificationsGateway = {
    sendNotificationFire: jest.fn(),
    handleJoinRoom: jest.fn(),
    server: {
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: NotificationsGateway,
          useValue: mockNotificationsGateway,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello Man!"', () => {
      expect(appController.getHello()).toBe('Hello Man!');
    });
  });
});
