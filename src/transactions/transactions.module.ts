import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { TransactionService } from './services/transaction.service';
import { TransactionController } from './controllers/transaction.controller';
import { BankResponseConsumer } from './consumers/bank-response.consumer';
import { TokenizationModule } from 'src/tokenization/tokenization.module';
import { OutboxModule } from 'src/common/outbox/outbox.module';
import { InboxModule } from 'src/common/inbox/inbox.module';
import { DatabaseModule } from 'src/common/database/database.module';
import { HmacModule } from 'src/common/hmac/hmac.module';
import { MerchantsModule } from 'src/merchants/merchants.module';
import { RabbitMQModule } from 'src/common/rabbitmq/rabbitmq.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    TokenizationModule,
    OutboxModule,
    InboxModule,
    DatabaseModule,
    HmacModule,
    MerchantsModule,
    RabbitMQModule,
    AuditModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService, BankResponseConsumer],
  exports: [TransactionService],
})
export class TransactionsModule {}
