import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { DLXSetupService } from './dlx-setup.service';

@Global()
@Module({
  providers: [RabbitMQService, DLXSetupService],
  exports: [RabbitMQService, DLXSetupService],
})
export class RabbitMQModule {}
