import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcquiringBankService } from './services/acquiring-bank.service';
import { TransactionConsumer } from './consumers/transaction.consumer';
import { RabbitMQModule } from 'src/common/rabbitmq/rabbitmq.module';
import { InboxModule } from 'src/common/inbox/inbox.module';
import { AuditModule } from 'src/audit/audit.module';
import {
  Transaction,
  TransactionSchema,
} from 'src/transactions/schemas/transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    RabbitMQModule,
    InboxModule,
    AuditModule,
  ],
  providers: [AcquiringBankService, TransactionConsumer],
  exports: [AcquiringBankService],
})
export class AcquiringBankModule {}
