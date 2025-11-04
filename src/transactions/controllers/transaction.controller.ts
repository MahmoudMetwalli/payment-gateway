import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TransactionService } from '../services/transaction.service';
import {
  CreatePurchaseDto,
  CreateRefundDto,
  CreateChargebackDto,
  TransactionResponseDto,
  ListTransactionsDto,
} from '../dto';
import { HmacAuth } from 'src/common/hmac/decorators/hmac-auth.decorator';
import { CurrentMerchant } from 'src/common/hmac/decorators/current-merchant.decorator';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  @HmacAuth()
  @ApiOperation({
    summary: 'Create a purchase transaction',
    description:
      'Creates a new purchase transaction. Returns immediately with pending status. Processing happens asynchronously.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Invalid HMAC signature' })
  async createPurchase(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @CurrentMerchant() merchant: { id: string },
  ): Promise<TransactionResponseDto> {
    return this.transactionService.createPurchase(
      createPurchaseDto,
      merchant.id,
    );
  }

  @Get()
  @HmacAuth()
  @ApiOperation({
    summary: 'List transactions',
    description: 'Get a paginated list of transactions with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of transactions',
  })
  async listTransactions(
    @Query() filters: ListTransactionsDto,
    @CurrentMerchant() merchant: { id: string },
  ): Promise<{ data: TransactionResponseDto[]; total: number; page: number; limit: number }> {
    return this.transactionService.listTransactions(merchant.id, filters);
  }

  @Get(':id')
  @HmacAuth()
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve details of a specific transaction',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(
    @Param('id') id: string,
    @CurrentMerchant() merchant: { id: string },
  ): Promise<TransactionResponseDto> {
    return this.transactionService.getTransaction(id, merchant.id);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.ACCEPTED)
  @HmacAuth()
  @ApiOperation({
    summary: 'Create a refund',
    description:
      'Initiates a refund for a transaction. Processing happens asynchronously.',
  })
  @ApiParam({ name: 'id', description: 'Original transaction ID' })
  @ApiResponse({
    status: 202,
    description: 'Refund request accepted',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async createRefund(
    @Param('id') id: string,
    @Body() createRefundDto: CreateRefundDto,
    @CurrentMerchant() merchant: { id: string },
  ): Promise<TransactionResponseDto> {
    return this.transactionService.createRefund(
      id,
      createRefundDto,
      merchant.id,
    );
  }

  @Post(':id/chargeback')
  @HttpCode(HttpStatus.ACCEPTED)
  @HmacAuth()
  @ApiOperation({
    summary: 'Create a chargeback',
    description:
      'Initiates a chargeback for a transaction. Processing happens asynchronously.',
  })
  @ApiParam({ name: 'id', description: 'Original transaction ID' })
  @ApiResponse({
    status: 202,
    description: 'Chargeback request accepted',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async createChargeback(
    @Param('id') id: string,
    @Body() createChargebackDto: CreateChargebackDto,
    @CurrentMerchant() merchant: { id: string },
  ): Promise<TransactionResponseDto> {
    return this.transactionService.createChargeback(
      id,
      createChargebackDto,
      merchant.id,
    );
  }
}

