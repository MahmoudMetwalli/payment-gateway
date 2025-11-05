import {
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseDto,
  CredsResponseDto,
  PasswordResponseDto,
  BankingInfoDto,
  BankingInfoResponseDto,
} from '../dto';

export interface IMerchantsService {
  create(createMerchantDto: CreateMerchantDto): Promise<MerchantResponseDto>;
  findByUserName(userName: string): Promise<PasswordResponseDto>;
  findByApiKey(apiKey: string): Promise<CredsResponseDto>;
  findById(id: string): Promise<MerchantResponseDto>;
  getBalance(id: string): Promise<number>;
  regenerateApiCredentials(id: string): Promise<CredsResponseDto>;
  update(updateMerchantDto: UpdateMerchantDto): Promise<MerchantResponseDto>;
  delete(id: string): Promise<void>;
  addBankingInfo(merchantId: string, bankingDto: BankingInfoDto): Promise<void>;
  getBankingInfo(merchantId: string): Promise<BankingInfoResponseDto>;
}

export const MERCHANTS_SERVICE = 'MERCHANTS_SERVICE';
