import {
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseDto,
} from '../dto';

export interface IMerchantsService {
  create(createMerchantDto: CreateMerchantDto): Promise<MerchantResponseDto>;
  findByUserName(userName: string): Promise<MerchantResponseDto>;
  findByApiKey(apiKey: string): Promise<MerchantResponseDto>;
  validateCredentials(userName: string, password: string): Promise<boolean>;
  regenerateApiCredentials(id: string): Promise<MerchantResponseDto>;
  update(
    id: string,
    updateMerchantDto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto>;
  delete(id: string): Promise<void>;
}

export interface IMerchantBalanceManager {
  updateBalance(
    id: string,
    amount: number,
    maxRetries?: number,
  ): Promise<MerchantResponseDto>;
}

export const MERCHANTS_SERVICE = 'MERCHANTS_SERVICE';
export const MERCHANT_BALANCE_MANAGER = 'MERCHANT_BALANCE_MANAGER';
