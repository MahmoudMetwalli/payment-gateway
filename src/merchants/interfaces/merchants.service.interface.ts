import {
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseDto,
  CredsResponseDto,
  PasswordResponseDto,
} from '../dto';

export interface IMerchantsService {
  create(createMerchantDto: CreateMerchantDto): Promise<MerchantResponseDto>;
  findByUserName(userName: string): Promise<PasswordResponseDto>;
  findByApiKey(apiKey: string): Promise<CredsResponseDto>;
  regenerateApiCredentials(id: string): Promise<CredsResponseDto>;
  update(updateMerchantDto: UpdateMerchantDto): Promise<MerchantResponseDto>;
  delete(id: string): Promise<void>;
}

export const MERCHANTS_SERVICE = 'MERCHANTS_SERVICE';
