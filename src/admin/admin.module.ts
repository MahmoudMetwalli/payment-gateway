import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './schemas/admin.schema';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from 'src/auth/auth.module';
import { Merchant, MerchantSchema } from 'src/merchants/schemas/merchants.schema';
import { Transaction, TransactionSchema } from 'src/transactions/schemas/transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Merchant.name, schema: MerchantSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
  exports: [AdminService],
})
export class AdminModule {}
