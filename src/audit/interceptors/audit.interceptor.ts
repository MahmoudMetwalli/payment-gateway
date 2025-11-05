import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';
import { UserType, AuditStatus } from '../schemas/audit-log.schema';
import { randomUUID } from 'crypto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip health checks and static files
    if (
      request.url.includes('/health') ||
      request.url.includes('/api') ||
      request.url.includes('/favicon')
    ) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(request, response, null);
        },
        error: (error) => {
          this.logRequest(request, response, error);
        },
      }),
    );
  }

  private async logRequest(request: any, response: any, error: any) {
    try {
      // Extract user info from request (PCI DSS 10.2.1)
      let userId = 'anonymous';
      let userName: string | undefined;
      let userType = UserType.SYSTEM;

      // Check for JWT authenticated user (merchant or admin)
      if (request.user) {
        userId = request.user.sub || request.user.id || 'unknown';
        userName = request.user.userName || request.user.username;
        userType =
          request.user.type === 'merchant' ? UserType.MERCHANT : UserType.ADMIN;
      }

      // Check for HMAC authenticated merchant
      if (request.merchant) {
        userId = request.merchant.id;
        userName = request.merchant.userName;
        userType = UserType.MERCHANT;
      }

      // Determine action from HTTP method and path (PCI DSS 10.2.2)
      const action = `${request.method} ${request.route?.path || request.url}`;
      const method = request.method;
      const endpoint = request.route?.path || request.url;

      // Extract resource from URL
      const resource = this.extractResource(request.url);

      // Get IP address (PCI DSS 10.2.1 & 10.2.5)
      const ipAddress =
        request.ip ||
        request.headers['x-forwarded-for']?.split(',')[0] ||
        request.connection?.remoteAddress ||
        'unknown';

      // Get user agent
      const userAgent = request.headers['user-agent'] || 'unknown';

      // Determine success or failure (PCI DSS 10.2.4)
      const statusCode = error ? error.status || 500 : response.statusCode;
      const status =
        statusCode >= 200 && statusCode < 400
          ? AuditStatus.SUCCESS
          : AuditStatus.FAILURE;

      // Generate request ID for correlation
      const requestId = randomUUID();

      // Check for sensitive data access (PCI DSS 10.2.6 & 10.2.7)
      const sensitiveDataAccessed = this.isSensitiveDataAccess(
        endpoint,
        request.body,
      );
      const cardholderDataAccess = this.isCardholderDataAccess(
        endpoint,
        request.body,
      );

      // Determine what data was accessed
      const dataAccessed = this.extractDataAccessed(resource, request.body);

      // Extract token IDs if present (never log actual card data)
      const tokenIds = this.extractTokenIds(request.body, request.params);

      // Prepare request details (will be sanitized in service)
      const requestDetails = {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
        headers: this.sanitizeHeaders(request.headers),
      };

      await this.auditService.logAction({
        // User identification (PCI DSS 10.2.1)
        userId,
        userName,
        userType,
        ipAddress,
        userAgent,

        // Event details (PCI DSS 10.2.2)
        action,
        resource,
        resourceId: request.params?.id,
        method,
        endpoint,

        // Success/Failure (PCI DSS 10.2.4)
        status,
        statusCode,
        errorMessage: error ? error.message : undefined,

        // Origination (PCI DSS 10.2.5)
        sourceHost: request.hostname,

        // Data access (PCI DSS 10.2.6 & 10.2.7)
        dataAccessed,
        sensitiveDataAccessed,
        cardholderDataAccess,
        tokenIds,

        // Additional context
        requestId,
        sessionId: request.session?.id,
        requestDetails,
      });
    } catch (logError) {
      // Silently fail - audit logging should not break the application
      console.error('Audit logging failed:', logError);
    }
  }

  /**
   * Check if the request involves sensitive data access
   */
  private isSensitiveDataAccess(endpoint: string, body: any): boolean {
    const sensitivePatterns = [
      'token',
      'card',
      'payment',
      'transaction',
      'balance',
      'credential',
      'secret',
    ];

    const endpointLower = endpoint.toLowerCase();
    return sensitivePatterns.some((pattern) => endpointLower.includes(pattern));
  }

  /**
   * Check if the request involves cardholder data access
   */
  private isCardholderDataAccess(endpoint: string, body: any): boolean {
    const cardholderPatterns = ['token', 'card', 'decrypt', 'tokenization'];

    const endpointLower = endpoint.toLowerCase();
    return cardholderPatterns.some((pattern) =>
      endpointLower.includes(pattern),
    );
  }

  /**
   * Extract what types of data were accessed
   */
  private extractDataAccessed(resource: string, body: any): string[] {
    const accessed: string[] = [resource];

    if (body) {
      if (body.token) accessed.push('token');
      if (body.amount || body.balance) accessed.push('financial_data');
      if (body.cardNumber) accessed.push('card_data');
      if (body.transactionId) accessed.push('transaction');
    }

    return [...new Set(accessed)]; // Remove duplicates
  }

  /**
   * Extract token IDs (never log actual card data)
   */
  private extractTokenIds(body: any, params: any): string[] {
    const tokenIds: string[] = [];

    if (body?.token) tokenIds.push(body.token);
    if (body?.tokenId) tokenIds.push(body.tokenId);
    if (params?.tokenId) tokenIds.push(params.tokenId);

    return tokenIds;
  }

  private extractResource(url: string): string {
    // Remove query parameters
    const cleanUrl = url.split('?')[0];

    // Extract resource from URL path
    const parts = cleanUrl.split('/').filter((p) => p);

    if (parts.length === 0) {
      return 'root';
    }

    // Return the first segment as the resource
    return parts[0];
  }

  private sanitizeHeaders(headers: any): Record<string, any> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    delete sanitized['authorization'];
    delete sanitized['x-signature'];
    delete sanitized['x-api-key'];
    delete sanitized['cookie'];

    return sanitized;
  }
}
