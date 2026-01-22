import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthMiddleware } from 'middleware/auth.middleware';
// import { CatsModule } from './cats/cats.module';
import { NotificationsGateway } from 'gateway/fireNotifications.gateway';
import { ScannerModule } from './scanner/scanner.module';
import { Scan } from './scanner/entities/scan.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    // PostgreSQL configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'scanner',
      password: process.env.DB_PASSWORD || 'scanner_password',
      database: process.env.DB_NAME || 'network_scanner',
      entities: [Scan],
      synchronize: true, // Auto-create tables (disable in production)
    }),
    // BullMQ configuration
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    // Keep MongoDB for existing UserModule
    // CatsModule, // Commented out - module doesn't exist
    ScannerModule,
  ],
  controllers: [AppController],
  providers: [AppService, NotificationsGateway],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('cat');
  }
}
