import {
  MerchantResponseDto,
  CredsResponseDto,
  UpdateBalanceDto,
} from '../dto';

export interface IMerchantTransactionManager {
  updateBalance(
    updateBalanceDto: UpdateBalanceDto,
  ): Promise<MerchantResponseDto>;
  findByApiKey(apiKey: string): Promise<CredsResponseDto>;
}

export const MERCHANTS_TRANSACTION_MANAGER = 'MERCHANTS_TRANSACTION_MANAGER';
