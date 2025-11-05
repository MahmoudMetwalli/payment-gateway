import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenVault, TokenVaultSchema } from './schemas/token-vault.schema';
import { EncryptionService } from './services/encryption.service';
import { TokenizationService } from './services/tokenization.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TokenVault.name, schema: TokenVaultSchema },
    ]),
    AuditModule,
  ],
  providers: [EncryptionService, TokenizationService],
  exports: [EncryptionService, TokenizationService],
})
export class TokenizationModule {}
