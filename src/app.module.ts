import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MerchantsModule } from './merchants/merchants.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { TokenizationModule } from './tokenization/tokenization.module';
import { TransactionsModule } from './transactions/transactions.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { DatabaseModule } from './common/database/database.module';
import { RabbitMQModule } from './common/rabbitmq/rabbitmq.module';
import { InboxModule } from './common/inbox/inbox.module';
import { AcquiringBankModule } from './acquiring-bank/acquiring-bank.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60) * 1000, // Convert to milliseconds
          limit: config.get('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    MerchantsModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    TokenizationModule,
    TransactionsModule,
    OutboxModule,
    DatabaseModule,
    RabbitMQModule,
    InboxModule,
    AcquiringBankModule,
    WebhooksModule,
    AuditModule,
    AdminModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
