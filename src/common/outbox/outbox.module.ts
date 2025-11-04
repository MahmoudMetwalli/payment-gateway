import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Outbox, OutboxSchema } from './schemas/outbox.schema';
import { OutboxService } from './services/outbox.service';
import { OutboxRelayService } from './services/outbox-relay.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Outbox.name, schema: OutboxSchema }]),
    RabbitMQModule,
  ],
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService],
})
export class OutboxModule {}

