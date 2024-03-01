import { Controller, Get, Post } from '@nestjs/common';
import { NotificationsGateway } from 'gateway/fireNotifications.gateway';

@Controller('cat')
export class CatController {
  constructor(private notificationsGateway: NotificationsGateway) {}

  @Get('notify')
  getHello(): string {
    this.notificationsGateway.sendNotificationFire(
      'heyyyy you just got notified',
    );

    return 'HEY IM A CAT';
  }
}
