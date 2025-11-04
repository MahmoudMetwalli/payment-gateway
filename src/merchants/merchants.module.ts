import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MerchantsService } from './services';
import { Merchant, MerchantSchema } from './schemas';
import { MERCHANTS_SERVICE, MERCHANTS_TRANSACTION_MANAGER } from './interfaces';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
  ],
  providers: [
    MerchantsService,
    {
      provide: MERCHANTS_SERVICE,
      useExisting: MerchantsService,
    },
    {
      provide: MERCHANTS_TRANSACTION_MANAGER,
      useExisting: MerchantsService,
    },
  ],
  exports: [MERCHANTS_SERVICE, MERCHANTS_TRANSACTION_MANAGER],
})
export class MerchantsModule {}
