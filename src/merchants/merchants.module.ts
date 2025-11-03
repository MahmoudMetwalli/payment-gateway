import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MerchantsService, MerchantSecurityService } from './services';
import { Merchant, MerchantSchema } from './schemas';
import {
  MERCHANTS_SERVICE,
  MERCHANTS_BALANCE_MANAGER,
  MERCHANTS_SECURITY_SERVICE,
} from './interfaces';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
  ],
  providers: [
    MerchantsService,
    MerchantSecurityService,
    {
      provide: MERCHANTS_SERVICE,
      useExisting: MerchantsService,
    },
    {
      provide: MERCHANTS_BALANCE_MANAGER,
      useExisting: MerchantsService,
    },
    {
      provide: MERCHANTS_SECURITY_SERVICE,
      useClass: MerchantSecurityService,
    },
  ],
  exports: [MERCHANTS_SERVICE, MERCHANTS_BALANCE_MANAGER],
})
export class MerchantsModule {}
