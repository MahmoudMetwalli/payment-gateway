import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../schemas/transaction.schema';
import {
  CreatePurchaseDto,
  CreateRefundDto,
  CreateChargebackDto,
  TransactionResponseDto,
  ListTransactionsDto,
} from '../dto';
import { TokenizationService } from 'src/tokenization/services/tokenization.service';
import { OutboxService } from 'src/common/outbox/services/outbox.service';
import { OutboxEventType } from 'src/common/outbox/schemas/outbox.schema';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
    private tokenizationService: TokenizationService,
    private outboxService: OutboxService,
  ) {}

  /**
   * Create a purchase transaction (SYNC - returns immediately)
   */
  async createPurchase(
    dto: CreatePurchaseDto,
    merchantId: string,
  ): Promise<TransactionResponseDto> {
    // Validate that either token or cardData is provided
    if (!dto.token && !dto.cardData) {
      throw new BadRequestException('Either token or cardData must be provided');
    }

    if (dto.token && dto.cardData) {
      throw new BadRequestException('Provide either token or cardData, not both');
    }

    let tokenData;

    // Tokenize card if raw data provided
    if (dto.cardData) {
      tokenData = await this.tokenizationService.tokenizeCard(
        dto.cardData,
        merchantId,
      );
    } else {
      // Get token info if token provided
      tokenData = await this.tokenizationService.getTokenInfo(
        dto.token!,
        merchantId,
      );
    }

    // Create transaction
    const transaction = new this.transactionModel({
      merchantId: new Types.ObjectId(merchantId),
      amount: dto.amount,
      currency: dto.currency || 'USD',
      status: TransactionStatus.PENDING,
      type: TransactionType.PURCHASE,
      tokenizedCardId: tokenData.token,
      cardLast4: tokenData.cardLast4,
      cardBrand: tokenData.cardBrand,
      refundedAmount: 0,
      metadata: dto.metadata || {},
    });

    const savedTransaction = await transaction.save();

    // Create outbox entry for async processing
    await this.outboxService.createOutboxEntry({
      aggregateId: savedTransaction._id.toString(),
      eventType: OutboxEventType.TRANSACTION_CREATED,
      payload: {
        transactionId: savedTransaction._id.toString(),
        merchantId,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        token: tokenData.token,
      },
    });

    return this.toResponseDto(savedTransaction);
  }

  /**
   * Get a single transaction
   */
  async getTransaction(
    id: string,
    merchantId: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionModel.findOne({
      _id: new Types.ObjectId(id),
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.toResponseDto(transaction);
  }

  /**
   * List transactions with filters
   */
  async listTransactions(
    merchantId: string,
    filters: ListTransactionsDto,
  ): Promise<{ data: TransactionResponseDto[]; total: number; page: number; limit: number }> {
    const query: any = { merchantId: new Types.ObjectId(merchantId) };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(query),
    ]);

    return {
      data: transactions.map((t) => this.toResponseDto(t)),
      total,
      page,
      limit,
    };
  }

  /**
   * Create a refund transaction (ASYNC - returns immediately with processing status)
   */
  async createRefund(
    transactionId: string,
    dto: CreateRefundDto,
    merchantId: string,
  ): Promise<TransactionResponseDto> {
    // Get original transaction
    const originalTransaction = await this.transactionModel.findOne({
      _id: new Types.ObjectId(transactionId),
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!originalTransaction) {
      throw new NotFoundException('Original transaction not found');
    }

    // Validate transaction can be refunded
    if (
      ![TransactionStatus.AUTHORIZED, TransactionStatus.CAPTURED].includes(
        originalTransaction.status,
      )
    ) {
      throw new BadRequestException(
        'Transaction must be authorized or captured to refund',
      );
    }

    // Calculate refundable amount
    const refundableAmount =
      originalTransaction.amount - originalTransaction.refundedAmount;

    if (dto.amount > refundableAmount) {
      throw new BadRequestException(
        `Refund amount exceeds refundable amount (${refundableAmount})`,
      );
    }

    // Create refund transaction
    const refundTransaction = new this.transactionModel({
      merchantId: new Types.ObjectId(merchantId),
      amount: dto.amount,
      currency: originalTransaction.currency,
      status: TransactionStatus.PENDING,
      type: TransactionType.REFUND,
      originalTransactionId: originalTransaction._id,
      cardLast4: originalTransaction.cardLast4,
      cardBrand: originalTransaction.cardBrand,
      metadata: { reason: dto.reason },
    });

    const savedRefund = await refundTransaction.save();

    // Create outbox entry for async processing
    await this.outboxService.createOutboxEntry({
      aggregateId: savedRefund._id.toString(),
      eventType: OutboxEventType.REFUND_REQUESTED,
      payload: {
        refundId: savedRefund._id.toString(),
        originalTransactionId: transactionId,
        merchantId,
        amount: dto.amount,
        reason: dto.reason,
      },
    });

    return this.toResponseDto(savedRefund);
  }

  /**
   * Create a chargeback transaction (ASYNC)
   */
  async createChargeback(
    transactionId: string,
    dto: CreateChargebackDto,
    merchantId: string,
  ): Promise<TransactionResponseDto> {
    // Get original transaction
    const originalTransaction = await this.transactionModel.findOne({
      _id: new Types.ObjectId(transactionId),
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!originalTransaction) {
      throw new NotFoundException('Original transaction not found');
    }

    // Create chargeback transaction
    const chargebackTransaction = new this.transactionModel({
      merchantId: new Types.ObjectId(merchantId),
      amount: originalTransaction.amount,
      currency: originalTransaction.currency,
      status: TransactionStatus.PENDING,
      type: TransactionType.CHARGEBACK,
      originalTransactionId: originalTransaction._id,
      cardLast4: originalTransaction.cardLast4,
      cardBrand: originalTransaction.cardBrand,
      metadata: { reason: dto.reason, disputeId: dto.disputeId },
    });

    const savedChargeback = await chargebackTransaction.save();

    // Create outbox entry
    await this.outboxService.createOutboxEntry({
      aggregateId: savedChargeback._id.toString(),
      eventType: OutboxEventType.CHARGEBACK_REQUESTED,
      payload: {
        chargebackId: savedChargeback._id.toString(),
        originalTransactionId: transactionId,
        merchantId,
        amount: originalTransaction.amount,
        reason: dto.reason,
        disputeId: dto.disputeId,
      },
    });

    return this.toResponseDto(savedChargeback);
  }

  /**
   * Update transaction status (used by acquiring bank response)
   */
  async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    authorizationCode?: string,
    failureReason?: string,
  ): Promise<void> {
    const update: any = { status };

    if (authorizationCode) {
      update.authorizationCode = authorizationCode;
    }

    if (failureReason) {
      update.failureReason = failureReason;
    }

    await this.transactionModel.findByIdAndUpdate(transactionId, update);
  }

  /**
   * Update refunded amount on original transaction
   */
  async updateRefundedAmount(
    transactionId: string,
    amount: number,
  ): Promise<void> {
    await this.transactionModel.findByIdAndUpdate(transactionId, {
      $inc: { refundedAmount: amount },
    });
  }

  /**
   * Convert transaction document to response DTO
   */
  private toResponseDto(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction._id.toString(),
      merchantId: transaction.merchantId.toString(),
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      type: transaction.type,
      cardLast4: transaction.cardLast4,
      cardBrand: transaction.cardBrand,
      authorizationCode: transaction.authorizationCode,
      failureReason: transaction.failureReason,
      originalTransactionId: transaction.originalTransactionId?.toString(),
      refundedAmount: transaction.refundedAmount,
      metadata: transaction.metadata,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}

