import { randomBytes } from 'crypto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
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
import { AuditService } from '../../audit/services/audit.service';
import { UserType, AuditStatus } from '../../audit/schemas/audit-log.schema';

@Injectable()
export class MerchantsService
  implements IMerchantsService, IMerchantTransactionManager
{
  constructor(
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
    private encryptionService: EncryptionService,
    private readonly auditService: AuditService,
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

  async getBalance(id: string): Promise<number> {
    const merchant = await this.merchantModel.findById(id).select('balance');
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant.balance;
  }

  async regenerateApiCredentials(
    id: string,
    ipAddress?: string,
  ): Promise<CredsResponseDto> {
    try {
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

      // PCI DSS - Log credential regeneration (security critical)
      await this.auditService.logAction({
        userId: id,
        userName: merchant.userName,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'CREDENTIAL_REGENERATE',
        eventCategory: 'system_administration',
        resource: 'credentials',
        resourceId: id,
        method: 'POST',
        endpoint: '/merchants/regenerate-credentials',
        status: AuditStatus.SUCCESS,
        statusCode: 200,
        sensitiveDataAccessed: true,
        metadata: {
          credentialType: 'api_credentials',
          operation: 'regenerate',
        },
      });

      return {
        id: updated._id.toString(),
        apiKey: updated.apiKey,
        apiSecret: updated.apiSecret,
      };
    } catch (error) {
      // PCI DSS - Log failed credential regeneration
      await this.auditService.logAction({
        userId: id,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'CREDENTIAL_REGENERATE',
        eventCategory: 'system_administration',
        resource: 'credentials',
        resourceId: id,
        method: 'POST',
        endpoint: '/merchants/regenerate-credentials',
        status: AuditStatus.FAILURE,
        statusCode: error instanceof NotFoundException ? 404 : 500,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        sensitiveDataAccessed: true,
        metadata: {
          credentialType: 'api_credentials',
          operation: 'regenerate',
        },
      });

      throw error;
    }
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
    session?: ClientSession,
    ipAddress?: string,
  ): Promise<MerchantResponseDto> {
    const maxRetries = 3;
    let retries = 0;
    let oldBalance: number | undefined;
    let newBalance: number | undefined;

    while (retries < maxRetries) {
      try {
        const merchant = await this.merchantModel
          .findById(updateBalanceDto.id)
          .session(session || null);
        if (!merchant) {
          throw new NotFoundException('Merchant not found');
        }

        oldBalance = merchant.balance;
        newBalance = merchant.balance + updateBalanceDto.amount;

        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }

        const updated = await this.merchantModel.findOneAndUpdate(
          { _id: updateBalanceDto.id, __v: merchant.__v },
          { balance: newBalance, $inc: { __v: 1 } },
          { new: true, session },
        );

        if (!updated) {
          retries++;
          continue;
        }

        // PCI DSS - Log balance change (financial data modification)
        await this.auditService.logAction({
          userId: updateBalanceDto.id,
          userName: merchant.userName,
          userType: UserType.SYSTEM,
          ipAddress: ipAddress || 'system',
          action: 'BALANCE_UPDATE',
          eventCategory: 'data_modification',
          resource: 'merchants',
          resourceId: updateBalanceDto.id,
          method: 'PATCH',
          endpoint: '/merchants/balance',
          status: AuditStatus.SUCCESS,
          statusCode: 200,
          sensitiveDataAccessed: true,
          dataAccessed: ['merchant_balance', 'financial_data'],
          changes: {
            before: { balance: oldBalance },
            after: { balance: newBalance },
          },
          metadata: {
            amount: updateBalanceDto.amount,
            reason: 'transaction',
          },
        });

        return this.toResponseDto(updated);
      } catch (error) {
        if (retries >= maxRetries - 1) {
          // PCI DSS - Log failed balance change
          await this.auditService.logAction({
            userId: updateBalanceDto.id,
            userType: UserType.SYSTEM,
            ipAddress: ipAddress || 'system',
            action: 'BALANCE_UPDATE',
            eventCategory: 'data_modification',
            resource: 'merchants',
            resourceId: updateBalanceDto.id,
            method: 'PATCH',
            endpoint: '/merchants/balance',
            status: AuditStatus.FAILURE,
            statusCode: error instanceof NotFoundException ? 404 : 500,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
            sensitiveDataAccessed: true,
            dataAccessed: ['merchant_balance'],
            metadata: {
              amount: updateBalanceDto.amount,
              reason: 'transaction',
              oldBalance,
              attemptedNewBalance: newBalance,
            },
          });

          throw error;
        }
        retries++;
      }
    }

    throw new ConflictException(
      'Failed to update balance after multiple retries',
    );
  }

  async updateWebhook(
    id: string,
    webhook: string[],
    ipAddress?: string,
  ): Promise<MerchantResponseDto> {
    try {
      const merchant = await this.merchantModel.findById(id);
      if (!merchant) {
        throw new NotFoundException('Merchant not found');
      }

      // Store current version
      const currentVersion = merchant.__v;

      // Update with version check
      const updated = await this.merchantModel.findOneAndUpdate(
        { _id: id, __v: currentVersion },
        { webhook, $inc: { __v: 1 } },
        { new: true, runValidators: true },
      );

      if (!updated) {
        throw new ConflictException(
          'Update conflict - merchant was modified by another request',
        );
      }

      // PCI DSS - Log webhook update
      await this.auditService.logAction({
        userId: id,
        userName: merchant.userName,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'WEBHOOK_UPDATE',
        eventCategory: 'system_administration',
        resource: 'merchants',
        resourceId: id,
        method: 'PATCH',
        endpoint: '/merchants/webhook',
        status: AuditStatus.SUCCESS,
        statusCode: 200,
        sensitiveDataAccessed: false,
        changes: {
          before: { webhook: merchant.webhook },
          after: { webhook },
        },
      });

      return this.toResponseDto(updated);
    } catch (error) {
      await this.auditService.logAction({
        userId: id,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'WEBHOOK_UPDATE',
        eventCategory: 'system_administration',
        resource: 'merchants',
        resourceId: id,
        method: 'PATCH',
        endpoint: '/merchants/webhook',
        status: AuditStatus.FAILURE,
        statusCode: error instanceof NotFoundException ? 404 : 500,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        sensitiveDataAccessed: false,
      });
      throw error;
    }
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
