import { Module } from '@nestjs/common';
import { CatController } from './cats.controller';
import { NotificationsGateway } from 'gateway/fireNotifications.gateway';

@Module({
  imports: [],
  controllers: [CatController],
  providers: [NotificationsGateway],
})
export class CatsModule {}
