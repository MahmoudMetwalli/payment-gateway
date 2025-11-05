import { randomBytes } from 'crypto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Merchant } from '../schemas';
import { IMerchantsService, IMerchantTransactionManager } from '../interfaces';
import {
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseDto,
  CredsResponseDto,
  UpdateBalanceDto,
  PasswordResponseDto,
} from '../dto';
import {
  BankingInfoDto,
  BankingInfoResponseDto,
} from '../dto/banking-info.dto';
import { EncryptionService } from 'src/tokenization/services/encryption.service';

@Injectable()
export class MerchantsService
  implements IMerchantsService, IMerchantTransactionManager
{
  constructor(
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
    private encryptionService: EncryptionService,
  ) {}

  async create(
    createMerchantDto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    const newMerchant = new this.merchantModel({
      ...createMerchantDto,
    });

    const saved = await newMerchant.save();
    return this.toResponseDto(saved);
  }

  async findByUserName(userName: string): Promise<PasswordResponseDto> {
    const merchant = await this.merchantModel.findOne({ userName });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return {
      id: merchant._id.toString(),
      userName: merchant.userName,
      password: merchant.password,
    };
  }

  async findByApiKey(apiKey: string): Promise<CredsResponseDto> {
    const merchant = await this.merchantModel.findOne({ apiKey });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return {
      id: merchant._id.toString(),
      apiKey: merchant.apiKey,
      apiSecret: merchant.apiSecret,
    };
  }

  async findById(id: string): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return this.toResponseDto(merchant);
  }

  async regenerateApiCredentials(id: string): Promise<CredsResponseDto> {
    const merchant = await this.merchantModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const apiKey = `pk_${randomBytes(32).toString('base64url')}`;
    const apiSecret = `sk_${randomBytes(64).toString('base64url')}`;
    const currentVersion = merchant.__v;

    const updated = await this.merchantModel.findOneAndUpdate(
      { _id: id, __v: currentVersion },
      { apiKey, apiSecret, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new ConflictException(
        'Update conflict - merchant was modified by another request',
      );
    }

    return {
      id: updated._id.toString(),
      apiKey: updated.apiKey,
      apiSecret: updated.apiSecret,
    };
  }

  async update(
    updateMerchantDto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findById(updateMerchantDto.id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Store current version
    const currentVersion = merchant.__v;

    // Update with version check
    const updated = await this.merchantModel.findOneAndUpdate(
      { _id: updateMerchantDto.id, __v: currentVersion },
      { ...updateMerchantDto, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new ConflictException(
        'Update conflict - merchant was modified by another request',
      );
    }

    return this.toResponseDto(updated);
  }

  async delete(id: string): Promise<void> {
    await this.merchantModel.findByIdAndDelete(id);
  }

  async updateBalance(
    updateBalanceDto: UpdateBalanceDto,
  ): Promise<MerchantResponseDto> {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const merchant = await this.merchantModel.findById(updateBalanceDto.id);
        if (!merchant) {
          throw new NotFoundException('Merchant not found');
        }

        const newBalance = merchant.balance + updateBalanceDto.amount;
        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }

        const updated = await this.merchantModel.findOneAndUpdate(
          { _id: updateBalanceDto.id, __v: merchant.__v },
          { balance: newBalance, $inc: { __v: 1 } },
          { new: true },
        );

        if (!updated) {
          retries++;
          continue;
        }

        return this.toResponseDto(updated);
      } catch (error) {
        if (retries >= maxRetries - 1) throw error;
        retries++;
      }
    }

    throw new ConflictException(
      'Failed to update balance after multiple retries',
    );
  }

  /**
   * Add or update banking information
   */
  async addBankingInfo(
    merchantId: string,
    bankingDto: BankingInfoDto,
  ): Promise<void> {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Encrypt sensitive banking info
    const encryptedAccountNumber = this.encryptionService.encrypt(
      bankingDto.bankAccountNumber,
    );
    const encryptedRoutingNumber = this.encryptionService.encrypt(
      bankingDto.bankRoutingNumber,
    );

    await this.merchantModel.findByIdAndUpdate(merchantId, {
      encryptedBankAccountNumber: encryptedAccountNumber,
      encryptedBankRoutingNumber: encryptedRoutingNumber,
      bankAccountHolderName: bankingDto.bankAccountHolderName,
      bankName: bankingDto.bankName,
    });
  }

  /**
   * Get banking information (decrypted but masked)
   */
  async getBankingInfo(merchantId: string): Promise<BankingInfoResponseDto> {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (!merchant.encryptedBankAccountNumber) {
      throw new NotFoundException('Banking information not configured');
    }

    const decryptedAccountNumber = this.encryptionService.decrypt(
      merchant.encryptedBankAccountNumber,
    );
    const decryptedRoutingNumber = this.encryptionService.decrypt(
      merchant.encryptedBankRoutingNumber,
    );

    return {
      bankAccountNumber: this.encryptionService.maskString(
        decryptedAccountNumber,
        4,
      ),
      bankRoutingNumber: decryptedRoutingNumber,
      bankAccountHolderName: merchant.bankAccountHolderName,
      bankName: merchant.bankName,
    };
  }

  private toResponseDto(merchant: Merchant): MerchantResponseDto {
    return {
      id: merchant._id.toString(),
      userName: merchant.userName,
      balance: merchant.balance,
      apiKey: merchant.apiKey,
      webhook: merchant.webhook,
    };
  }
}
