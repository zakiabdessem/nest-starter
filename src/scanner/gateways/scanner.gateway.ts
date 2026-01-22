import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ScannerService } from '../services/scanner.service';
import { CreateScanDto } from '../dtos/create-scan.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ScannerGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly scannerService: ScannerService) {}

  /**
   * Handle start-scan message from client
   */
  @SubscribeMessage('start-scan')
  async handleStartScan(
    @MessageBody() createScanDto: CreateScanDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const scan = await this.scannerService.createScan(createScanDto);
      
      // Join client to scan-specific room
      client.join(`scan-${scan.id}`);
      
      return {
        success: true,
        data: scan,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle join-scan-room message
   */
  @SubscribeMessage('join-scan-room')
  handleJoinScanRoom(
    @MessageBody() data: { scanId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`scan-${data.scanId}`);
    return { success: true, message: `Joined scan room: ${data.scanId}` };
  }

  /**
   * Emit scan update to specific scan room
   */
  emitScanUpdate(scanId: string, event: string, data: any) {
    this.server.to(`scan-${scanId}`).emit(event, data);
  }

  /**
   * Emit scan started event
   */
  emitScanStarted(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'scan-started', data);
  }

  /**
   * Emit DNS resolved event
   */
  emitDnsResolved(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'dns-resolved', data);
  }

  /**
   * Emit scanning ports event
   */
  emitScanningPorts(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'scanning-ports', data);
  }

  /**
   * Emit scan complete event
   */
  emitScanComplete(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'scan-complete', data);
  }

  /**
   * Emit scan failed event
   */
  emitScanFailed(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'scan-failed', data);
  }

  /**
   * Emit vulnerability scan started event
   */
  emitVulnerabilityScanStarted(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'vulnerability-scan-started', data);
  }

  /**
   * Emit vulnerability scan complete event
   */
  emitVulnerabilityScanComplete(scanId: string, data: any) {
    this.emitScanUpdate(scanId, 'vulnerability-scan-complete', data);
  }
}
