import { Module } from '@nestjs/common';
import { WebhookService } from './services/webhook.service';
import { WebhookConsumer } from './consumers/webhook.consumer';
import { RabbitMQModule } from 'src/common/rabbitmq/rabbitmq.module';
import { HmacModule } from 'src/common/hmac/hmac.module';
import { MerchantsModule } from 'src/merchants/merchants.module';

@Module({
  imports: [RabbitMQModule, HmacModule, MerchantsModule],
  providers: [WebhookService, WebhookConsumer],
  exports: [WebhookService],
})
export class WebhooksModule {}

