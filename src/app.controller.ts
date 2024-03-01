import { Controller, Get, Post, Render } from '@nestjs/common';
import { AppService } from './app.service';
import { NotificationsGateway } from 'gateway/fireNotifications.gateway';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get()
  @Render('index')
  root() {
    return { message: 'Hello world!' };
  }

  @Post('/notify')
  notify() {
    const data = { message: 'This is a test notification!' };
    this.notificationsGateway.sendNotificationFire(data);
    return { status: 'Notification sent' };
  }
}
