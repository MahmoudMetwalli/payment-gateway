import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // User ID
  userName: string;
  type: 'merchant' | 'admin';
  role?: string; // Admin role
  iat?: number; // Issued at
  exp?: number; // Expiration
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  // Generate access token (short-lived)
  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const secret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
    // Type assertion to work around strict typing in @nestjs/jwt
    return (this.nestJwtService as any).sign(payload, { secret, expiresIn });
  }

  // Generate refresh token (long-lived)
  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret';
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    // Type assertion to work around strict typing in @nestjs/jwt
    return (this.nestJwtService as any).sign(payload, { secret, expiresIn });
  }

  // Generate both tokens
  generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  // Verify access token
  verifyAccessToken(token: string): JwtPayload {
    return this.nestJwtService.verify(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });
  }

  // Verify refresh token
  verifyRefreshToken(token: string): JwtPayload {
    return this.nestJwtService.verify(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });
  }

  // Decode without verification (useful for debugging)
  decode(token: string): JwtPayload | null {
    return this.nestJwtService.decode(token) as JwtPayload;
  }
}
