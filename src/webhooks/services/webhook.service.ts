import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookEventDto } from '../dto/webhook-event.dto';
import { HmacService } from 'src/common/hmac/services/hmac.service';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantsService } from 'src/merchants/interfaces';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private hmacService: HmacService,
    private configService: ConfigService,
    @Inject(MERCHANTS_SERVICE)
    private merchantsService: IMerchantsService,
  ) {}

  /**
   * Deliver webhook to merchant endpoints with retry logic
   */
  async deliverWebhook(
    merchantId: string,
    event: WebhookEventDto,
  ): Promise<void> {
    try {
      // Fetch merchant data to get webhook URLs and apiSecret
      const merchant = await this.merchantsService.findByUserName(
        merchantId,
      ).catch(() => null);

      if (!merchant) {
        this.logger.warn(`Merchant ${merchantId} not found for webhook delivery`);
        return;
      }

      // Get merchant's full data to access webhook URLs
      // In production, you'd fetch the full merchant record with webhooks
      // For now, we'll use a simplified approach
      const webhookUrls = await this.getMerchantWebhooks(merchantId);

      if (!webhookUrls || webhookUrls.length === 0) {
        this.logger.debug(`No webhook URLs configured for merchant ${merchantId}`);
        return;
      }

      // Get merchant's API secret for signing
      const creds = await this.merchantsService.findByApiKey(merchantId);

      // Prepare webhook payload
      const payload = {
        event: 'transaction.updated',
        data: event,
      };

      const payloadString = JSON.stringify(payload);

      // Sign payload with merchant's apiSecret
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signaturePayload = this.hmacService.createPayload(
        payload,
        timestamp,
      );
      const signature = this.hmacService.generateSignature(
        signaturePayload,
        creds.apiSecret,
      );

      // Deliver to each webhook URL with retry logic
      for (const url of webhookUrls) {
        await this.deliverToUrl(url, payloadString, signature, timestamp);
      }
    } catch (error) {
      this.logger.error(
        `Failed to deliver webhook for merchant ${merchantId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Deliver webhook to a specific URL with exponential backoff retry
   */
  private async deliverToUrl(
    url: string,
    payload: string,
    signature: string,
    timestamp: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Timestamp': timestamp,
            'User-Agent': 'PaymentGateway-Webhook/1.0',
          },
          body: payload,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          this.logger.log(`Webhook delivered successfully to ${url}`);
          return;
        } else {
          this.logger.warn(
            `Webhook delivery to ${url} failed with status ${response.status}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error delivering webhook to ${url} (attempt ${attempt + 1}):`,
          error.message,
        );
      }

      attempt++;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }

    this.logger.error(
      `Failed to deliver webhook to ${url} after ${maxRetries} attempts`,
    );
  }

  /**
   * Get webhook URLs for a merchant
   * In a real implementation, this would fetch from the merchant record
   */
  private async getMerchantWebhooks(merchantId: string): Promise<string[]> {
    // This is a placeholder - in production, fetch from merchant record
    // For now, return empty array or use environment variable for testing
    return [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

