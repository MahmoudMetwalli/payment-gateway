import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';
import { UserType } from '../schemas/audit-log.schema';

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
      // Extract user info from request
      let userId = 'anonymous';
      let userType = UserType.SYSTEM;

      // Check for JWT authenticated user (merchant or admin)
      if (request.user) {
        userId = request.user.sub || request.user.id || 'unknown';
        userType = request.user.type === 'merchant' ? UserType.MERCHANT : UserType.ADMIN;
      }

      // Check for HMAC authenticated merchant
      if (request.merchant) {
        userId = request.merchant.id;
        userType = UserType.MERCHANT;
      }

      // Determine action from HTTP method and path
      const action = `${request.method} ${request.route?.path || request.url}`;

      // Extract resource from URL
      const resource = this.extractResource(request.url);

      // Get IP address
      const ipAddress =
        request.ip ||
        request.headers['x-forwarded-for']?.split(',')[0] ||
        request.connection?.remoteAddress ||
        'unknown';

      // Get user agent
      const userAgent = request.headers['user-agent'] || 'unknown';

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
        userId,
        userType,
        action,
        resource,
        resourceId: request.params?.id,
        requestDetails,
        ipAddress,
        userAgent,
        statusCode: error ? error.status || 500 : response.statusCode,
        errorMessage: error ? error.message : undefined,
      });
    } catch (logError) {
      // Silently fail - audit logging should not break the application
      console.error('Audit logging failed:', logError);
    }
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

