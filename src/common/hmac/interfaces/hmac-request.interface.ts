import { Request } from 'express';

export interface HmacRequest extends Request {
  merchant?: {
    id: string;
    apiKey: string;
    apiSecret: string;
  };
}

