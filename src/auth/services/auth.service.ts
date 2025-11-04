import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantsService } from 'src/merchants/interfaces';
import { AuthDto } from '../dto';
import { JwtService, TokenPair } from './jwt.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(MERCHANTS_SERVICE)
    private readonly merchantsService: IMerchantsService,
    private readonly jwtService: JwtService,
  ) {}

  private readonly saltRounds = 10;

  async merchantsSignIn(authDto: AuthDto): Promise<TokenPair> {
    const merchant = await this.merchantsService.findByUserName(
      authDto.userName,
    );

    const correctPassword = await this.comparePassword(
      authDto.password,
      merchant.password,
    );

    if (!correctPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    return this.jwtService.generateTokenPair({
      sub: merchant.id,
      userName: merchant.userName,
      type: 'merchant',
    });
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
