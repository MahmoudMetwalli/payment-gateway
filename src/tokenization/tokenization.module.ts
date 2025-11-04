import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenVault, TokenVaultSchema } from './schemas/token-vault.schema';
import { EncryptionService } from './services/encryption.service';
import { TokenizationService } from './services/tokenization.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TokenVault.name, schema: TokenVaultSchema },
    ]),
  ],
  providers: [EncryptionService, TokenizationService],
  exports: [EncryptionService, TokenizationService],
})
export class TokenizationModule {}

