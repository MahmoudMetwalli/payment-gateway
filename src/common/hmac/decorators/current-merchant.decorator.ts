import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { HmacRequest } from '../interfaces/hmac-request.interface';

/**
 * Decorator to extract merchant info from request
 * Use after @HmacAuth() guard
 */
export const CurrentMerchant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<HmacRequest>();
    return request.merchant;
  },
);

