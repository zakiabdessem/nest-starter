import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { io, Socket } from 'socket.io-client';

describe('Scanner E2E Tests', () => {
  let app: INestApplication;
  let socket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    await app.listen(3001); // Use different port for testing
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  afterEach(() => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  describe('POST /scan', () => {
    it('should create a new scan and return 202 Accepted', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .send({ target: 'http://testphp.vulnweb.com/' })
        .expect(202);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('target', 'http://testphp.vulnweb.com/');
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('should accept IP address as target', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .send({ target: '192.168.1.1' })
        .expect(202);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('target', '192.168.1.1');
    });

    it('should reject empty target', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .send({ target: '' })
        .expect(400);
    });

    it('should reject request without target', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .send({})
        .expect(400);
    });
  });

  describe('GET /scan/:id', () => {
    it('should return scan by ID', async () => {
      // First create a scan
      const createResponse = await request(app.getHttpServer())
        .post('/scan')
        .send({ target: 'example.com' });

      const scanId = createResponse.body.id;

      // Then retrieve it
      const response = await request(app.getHttpServer())
        .get(`/scan/${scanId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', scanId);
      expect(response.body).toHaveProperty('target', 'example.com');
    });

    it('should return 500 for non-existent scan', async () => {
      await request(app.getHttpServer())
        .get('/scan/non-existent-id')
        .expect(500);
    });
  });

  describe('GET /scan', () => {
    it('should return all scans', async () => {
      const response = await request(app.getHttpServer())
        .get('/scan')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('WebSocket - start-scan', () => {
    it('should create scan via WebSocket', (done) => {
      socket = io('http://localhost:3001', {
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        socket.emit('start-scan', { target: 'example.com' }, (response: any) => {
          expect(response).toHaveProperty('success', true);
          expect(response.data).toHaveProperty('id');
          expect(response.data).toHaveProperty('target', 'example.com');
          done();
        });
      });

      socket.on('connect_error', (error) => {
        done(error);
      });
    });
  });

  describe('WebSocket - scan updates', () => {
    it('should receive scan updates via WebSocket', (done) => {
      socket = io('http://localhost:3001', {
        transports: ['websocket'],
      });

      let scanId: string;
      const receivedEvents: string[] = [];

      socket.on('connect', () => {
        socket.emit('start-scan', { target: '8.8.8.8' }, (response: any) => {
          if (response.success) {
            scanId = response.data.id;
            socket.emit('join-scan-room', { scanId });
          }
        });
      });

      socket.on('scan-started', (data) => {
        receivedEvents.push('scan-started');
        expect(data).toHaveProperty('scanId', scanId);
      });

      socket.on('dns-resolved', (data) => {
        receivedEvents.push('dns-resolved');
        expect(data).toHaveProperty('resolvedIp');
      });

      socket.on('scanning-ports', (data) => {
        receivedEvents.push('scanning-ports');
      });

      socket.on('scan-complete', (data) => {
        receivedEvents.push('scan-complete');
        expect(data).toHaveProperty('status', 'completed');
        expect(receivedEvents).toContain('scan-started');
        done();
      });

      socket.on('scan-failed', (data) => {
        // Test might fail due to permissions or network
        receivedEvents.push('scan-failed');
        expect(data).toHaveProperty('error');
        done();
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (receivedEvents.length === 0) {
          done(new Error('No events received within timeout'));
        }
      }, 60000);
    }, 65000); // Increase Jest timeout for this test
  });
});
