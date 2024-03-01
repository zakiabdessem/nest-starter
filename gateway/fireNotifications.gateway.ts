import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  sendNotificationFire(data: any) {
    this.server.emit('notification-fire', data);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: any, room: string) {
    client.join(room);
    return 'joined room ' + room;
  }
}
