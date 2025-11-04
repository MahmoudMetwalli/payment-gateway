import { Module } from '@nestjs/common';
import { HmacService } from './services/hmac.service';
import { HmacGuard } from './guards/hmac.guard';
import { MerchantsModule } from 'src/merchants/merchants.module';

@Module({
  imports: [MerchantsModule],
  providers: [HmacService, HmacGuard],
  exports: [HmacService, HmacGuard],
})
export class HmacModule {}

