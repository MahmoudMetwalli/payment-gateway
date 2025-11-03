import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Merchant } from '../schemas';
import {
  IMerchantsService,
  IMerchantBalanceManager,
  MERCHANTS_SECURITY_SERVICE,
} from '../interfaces';
import type { IMerchantSecurityService } from '../interfaces';
import {
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseDto,
} from '../dto';

@Injectable()
export class MerchantsService
  implements IMerchantsService, IMerchantBalanceManager
{
  constructor(
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
    @Inject(MERCHANTS_SECURITY_SERVICE)
    private readonly merchantSecurityService: IMerchantSecurityService,
  ) {}

  async create(
    createMerchantDto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    // Hash password and generate API credentials
    const hashedPassword = await this.merchantSecurityService.hashPassword(
      createMerchantDto.password,
    );
    const { apiKey, apiSecret } =
      this.merchantSecurityService.generateApiCredentials();

    const newMerchant = new this.merchantModel({
      ...createMerchantDto,
      password: hashedPassword,
      apiKey,
      apiSecret,
      balance: createMerchantDto.balance || 0,
    });

    const saved = await newMerchant.save();
    return this.toResponseDto(saved);
  }

  async findByUserName(userName: string): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findOne({ userName });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return this.toResponseDto(merchant);
  }

  async findByApiKey(apiKey: string): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findOne({ apiKey });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return this.toResponseDto(merchant);
  }

  async validateCredentials(
    userName: string,
    password: string,
  ): Promise<boolean> {
    const merchant = await this.merchantModel.findOne({ userName });
    if (!merchant) {
      return false;
    }

    return this.merchantSecurityService.comparePassword(
      password,
      merchant.password,
    );
  }

  async regenerateApiCredentials(id: string): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const { apiKey, apiSecret } =
      this.merchantSecurityService.generateApiCredentials();

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

    return this.toResponseDto(updated);
  }

  async update(
    id: string,
    updateMerchantDto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto> {
    const merchant = await this.merchantModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Hash password if it's being updated
    const updateData = { ...updateMerchantDto };
    if (updateMerchantDto.password) {
      updateData.password = await this.merchantSecurityService.hashPassword(
        updateMerchantDto.password,
      );
    }

    // Store current version
    const currentVersion = merchant.__v;

    // Update with version check
    const updated = await this.merchantModel.findOneAndUpdate(
      { _id: id, __v: currentVersion },
      { ...updateData, $inc: { __v: 1 } },
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
    id: string,
    amount: number,
    maxRetries = 3,
  ): Promise<MerchantResponseDto> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const merchant = await this.merchantModel.findById(id);
        if (!merchant) {
          throw new NotFoundException('Merchant not found');
        }

        const newBalance = merchant.balance + amount;
        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }

        const updated = await this.merchantModel.findOneAndUpdate(
          { _id: id, __v: merchant.__v },
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

  private toResponseDto(merchant: Merchant): MerchantResponseDto {
    return {
      userName: merchant.userName,
      balance: merchant.balance,
      apiKey: merchant.apiKey,
    };
  }
}
