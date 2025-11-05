import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantsService } from 'src/merchants/interfaces';
import { AuthDto } from '../dto';
import { JwtService, TokenPair } from './jwt.service';
import { AuditService } from '../../audit/services/audit.service';
import { UserType, AuditStatus } from 'src/audit/schemas/audit-log.schema';

@Injectable()
export class AuthService {
  constructor(
    @Inject(MERCHANTS_SERVICE)
    private readonly merchantsService: IMerchantsService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private readonly saltRounds = 10;

  async merchantsSignIn(
    authDto: AuthDto,
    ipAddress?: string,
  ): Promise<TokenPair> {
    let merchant;
    let success = false;
    let errorMessage: string | undefined;

    try {
      merchant = await this.merchantsService.findByUserName(authDto.userName);

      const correctPassword = await this.comparePassword(
        authDto.password,
        merchant.password,
      );

      if (!correctPassword) {
        throw new UnauthorizedException('Invalid credentials');
      }

      success = true;

      // Generate JWT tokens
      const tokens = this.jwtService.generateTokenPair({
        sub: merchant.id,
        userName: merchant.userName,
        type: 'merchant',
      });

      // PCI DSS 10.2.1 - Log successful authentication
      await this.auditService.logAction({
        userId: merchant.id,
        userName: merchant.userName,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'AUTHENTICATION_PASSWORD',
        eventCategory: 'authentication',
        resource: 'auth',
        method: 'POST',
        endpoint: '/auth/login',
        status: AuditStatus.SUCCESS,
        statusCode: 200,
        sensitiveDataAccessed: true,
      });

      return tokens;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // PCI DSS 10.2.1 & 10.2.4 - Log failed authentication
      await this.auditService.logAction({
        userId: merchant?.id || 'unknown',
        userName: authDto.userName,
        userType: UserType.MERCHANT,
        ipAddress: ipAddress || 'unknown',
        action: 'AUTHENTICATION_PASSWORD',
        eventCategory: 'authentication',
        resource: 'auth',
        method: 'POST',
        endpoint: '/auth/login',
        status: AuditStatus.FAILURE,
        statusCode: 401,
        errorMessage,
        sensitiveDataAccessed: true,
      });

      throw error;
    }
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(
    candidatePassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }
}
