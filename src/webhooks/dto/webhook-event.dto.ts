export class WebhookEventDto {
  eventType: string;
  transactionId: string;
  status: string;
  success: boolean;
  authorizationCode?: string;
  failureReason?: string;
  amount: number;
  isRefund: boolean;
  isChargeback: boolean;
  timestamp: string;
  data?: Record<string, any>;
}

