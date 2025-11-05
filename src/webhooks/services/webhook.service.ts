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
      const merchant = await this.merchantsService
        .findById(merchantId)
        .catch(() => null);

      if (!merchant) {
        this.logger.warn(
          `Merchant ${merchantId} not found for webhook delivery`,
        );
        return;
      }

      const webhookUrls = merchant.webhook;

      if (!webhookUrls || webhookUrls.length === 0) {
        this.logger.debug(
          `No webhook URLs configured for merchant ${merchantId}`,
        );
        return;
      }

      // Get merchant's API secret for signing
      const creds = await this.merchantsService.findByApiKey(merchant.apiKey);

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
      const deliveryPromises = webhookUrls.map((url) =>
        this.deliverToUrl(url, payloadString, signature, timestamp),
      );

      const results = await Promise.allSettled(deliveryPromises);

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `Failed to deliver webhook to ${webhookUrls[index]}: ${result.reason}`,
          );
        } else {
          this.logger.log(
            `Successfully delivered webhook to ${webhookUrls[index]}`,
          );
        }
      });

      // Check if all failed
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        throw new Error('All webhook deliveries failed');
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
    const maxRetries = this.configService.get<number>('WEBHOOK_MAX_RETRIES', 3);
    const timeoutMs = this.configService.get<number>(
      'WEBHOOK_TIMEOUT_MS',
      10000,
    );
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
          signal: AbortSignal.timeout(timeoutMs),
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
