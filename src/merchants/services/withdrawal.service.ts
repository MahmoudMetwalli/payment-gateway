import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Withdrawal, WithdrawalStatus } from '../schemas/withdrawal.schema';
import { Merchant } from '../schemas/merchants.schema';
import { CreateWithdrawalDto, WithdrawalResponseDto } from '../dto/create-withdrawal.dto';
import { MERCHANTS_SERVICE } from '../interfaces';
import type { IMerchantTransactionManager } from '../interfaces';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectModel(Withdrawal.name)
    private withdrawalModel: Model<Withdrawal>,
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
    @Inject(MERCHANTS_SERVICE)
    private merchantTransactionManager: IMerchantTransactionManager,
  ) {}

  /**
   * Create a withdrawal request
   */
  async createWithdrawal(
    merchantId: string,
    dto: CreateWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    // Get merchant details
    const merchant = await this.merchantModel.findById(merchantId);

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    // Check if banking info is set
    if (!merchant.encryptedBankAccountNumber) {
      throw new BadRequestException('Banking information not configured');
    }

    // Check balance
    if (merchant.balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Deduct from merchant balance
    await this.merchantTransactionManager.updateBalance({
      id: merchantId,
      amount: -dto.amount,
    });

    // Create withdrawal record
    const withdrawal = new this.withdrawalModel({
      merchantId: new Types.ObjectId(merchantId),
      amount: dto.amount,
      status: WithdrawalStatus.PROCESSING,
      bankAccountLast4: merchant.encryptedBankAccountNumber?.slice(-4) || '****',
    });

    const saved = await withdrawal.save();

    // In production, this would trigger actual bank transfer
    // For now, we'll just mark it as completed
    setTimeout(async () => {
      await this.withdrawalModel.findByIdAndUpdate(saved._id, {
        status: WithdrawalStatus.COMPLETED,
        processedAt: new Date(),
      });
    }, 2000);

    return this.toResponseDto(saved);
  }

  /**
   * List withdrawals for a merchant
   */
  async listWithdrawals(merchantId: string): Promise<WithdrawalResponseDto[]> {
    const withdrawals = await this.withdrawalModel
      .find({ merchantId: new Types.ObjectId(merchantId) })
      .sort({ createdAt: -1 })
      .exec();

    return withdrawals.map((w) => this.toResponseDto(w));
  }

  /**
   * Get withdrawal by ID
   */
  async getWithdrawal(
    withdrawalId: string,
    merchantId: string,
  ): Promise<WithdrawalResponseDto> {
    const withdrawal = await this.withdrawalModel.findOne({
      _id: new Types.ObjectId(withdrawalId),
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    return this.toResponseDto(withdrawal);
  }

  private toResponseDto(withdrawal: Withdrawal): WithdrawalResponseDto {
    return {
      id: withdrawal._id.toString(),
      merchantId: withdrawal.merchantId.toString(),
      amount: withdrawal.amount,
      status: withdrawal.status,
      bankAccountLast4: withdrawal.bankAccountLast4,
      createdAt: withdrawal.createdAt,
      processedAt: withdrawal.processedAt,
    };
  }
}

