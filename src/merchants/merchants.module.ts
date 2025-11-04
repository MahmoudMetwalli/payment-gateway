import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MerchantsService } from './services';
import { WithdrawalService } from './services/withdrawal.service';
import { MerchantsController } from './controllers/merchants.controller';
import { Merchant, MerchantSchema, Withdrawal, WithdrawalSchema } from './schemas';
import { MERCHANTS_SERVICE, MERCHANTS_TRANSACTION_MANAGER } from './interfaces';
import { TokenizationModule } from 'src/tokenization/tokenization.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
      { name: Withdrawal.name, schema: WithdrawalSchema },
    ]),
    TokenizationModule,
  ],
  controllers: [MerchantsController],
  providers: [
    MerchantsService,
    WithdrawalService,
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
