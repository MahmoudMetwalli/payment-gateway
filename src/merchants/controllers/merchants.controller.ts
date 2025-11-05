import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/services/jwt.service';
import { MerchantsService } from '../services/merchants.service';
import { WithdrawalService } from '../services/withdrawal.service';
import {
  BankingInfoDto,
  BankingInfoResponseDto,
} from '../dto/banking-info.dto';
import {
  CreateWithdrawalDto,
  WithdrawalResponseDto,
} from '../dto/create-withdrawal.dto';
import { CredsResponseDto } from '../dto/creds-response.dto';
import { BalanceResponseDto } from '../dto/balance-response.dto';

@ApiTags('Merchants')
@Controller('merchants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly withdrawalService: WithdrawalService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get merchant profile' })
  @ApiResponse({ status: 200, description: 'Merchant profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return { userId: user.sub, userName: user.userName };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get merchant balance' })
  @ApiResponse({
    status: 200,
    description: 'Merchant current balance',
    type: BalanceResponseDto,
  })
  async getBalance(
    @CurrentUser('sub') userId: string,
  ): Promise<BalanceResponseDto> {
    const balance = await this.merchantsService.getBalance(userId);
    return { balance, currency: 'USD' };
  }

  @Post('banking-info')
  @ApiOperation({ summary: 'Add or update banking information' })
  @ApiResponse({ status: 200, description: 'Banking info updated' })
  async addBankingInfo(
    @CurrentUser('sub') userId: string,
    @Body() bankingDto: BankingInfoDto,
  ): Promise<void> {
    return this.merchantsService.addBankingInfo(userId, bankingDto);
  }

  @Get('banking-info')
  @ApiOperation({ summary: 'Get banking information' })
  @ApiResponse({
    status: 200,
    description: 'Banking info',
    type: BankingInfoResponseDto,
  })
  async getBankingInfo(
    @CurrentUser('sub') userId: string,
  ): Promise<BankingInfoResponseDto> {
    return this.merchantsService.getBankingInfo(userId);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Create a withdrawal request' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal created',
    type: WithdrawalResponseDto,
  })
  async createWithdrawal(
    @CurrentUser('sub') userId: string,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalService.createWithdrawal(userId, createWithdrawalDto);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List withdrawals' })
  @ApiResponse({
    status: 200,
    description: 'List of withdrawals',
    type: [WithdrawalResponseDto],
  })
  async listWithdrawals(
    @CurrentUser('sub') userId: string,
  ): Promise<WithdrawalResponseDto[]> {
    return this.withdrawalService.listWithdrawals(userId);
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Get withdrawal by ID' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal details',
    type: WithdrawalResponseDto,
  })
  async getWithdrawal(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalService.getWithdrawal(id, userId);
  }

  @Post('credentials/regenerate')
  @ApiOperation({ summary: 'Generate new API key and API secret' })
  @ApiResponse({
    status: 200,
    description: 'New API credentials generated',
    type: CredsResponseDto,
  })
  async regenerateCredentials(
    @CurrentUser('sub') userId: string,
  ): Promise<CredsResponseDto> {
    return this.merchantsService.regenerateApiCredentials(userId);
  }
}
