import { ClientSession } from 'mongoose';
import {
  MerchantResponseDto,
  CredsResponseDto,
  UpdateBalanceDto,
} from '../dto';

export interface IMerchantTransactionManager {
  updateBalance(
    updateBalanceDto: UpdateBalanceDto,
    session?: ClientSession,
  ): Promise<MerchantResponseDto>;
  findByApiKey(apiKey: string): Promise<CredsResponseDto>;
}

export const MERCHANTS_TRANSACTION_MANAGER = 'MERCHANTS_TRANSACTION_MANAGER';
