import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { JwtService, TokenPair } from '../services/jwt.service';
import { AuthDto } from '../dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreateMerchantDto, MerchantResponseDto } from '../../merchants/dto';
import type { IMerchantsService } from '../../merchants/interfaces';
import { MERCHANTS_SERVICE } from '../../merchants/interfaces';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @Inject(MERCHANTS_SERVICE)
    private readonly merchantsService: IMerchantsService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Merchant login' })
  @ApiBody({
    type: AuthDto,
    examples: {
      default: {
        summary: 'Example',
        value: { userName: 'acme', password: 'StrongPass123' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() authDto: AuthDto): Promise<TokenPair> {
    return this.authService.merchantsSignIn(authDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
      },
      required: ['refreshToken'],
    },
  })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verifyRefreshToken(refreshToken);

      // Generate new token pair
      return this.jwtService.generateTokenPair({
        sub: payload.sub,
        userName: payload.userName,
        type: payload.type,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Merchant signup' })
  @ApiBody({
    type: CreateMerchantDto,
    examples: {
      default: {
        summary: 'Example',
        value: { userName: 'acme', password: 'StrongPass123' },
      },
    },
  })
  async register(
    @Body() createMerchantDto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    const hashedPassword = await this.authService.hashPassword(
      createMerchantDto.password,
    );

    return this.merchantsService.create({
      userName: createMerchantDto.userName,
      password: hashedPassword,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('sub') userId: string) {
    // Optional: Implement token blacklist/revocation here
    // For now, just return success (client should delete tokens)
    return {
      message: 'Logged out successfully',
      userId,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@CurrentUser() user: any) {
    return {
      valid: true,
      user: {
        id: user.sub,
        userName: user.userName,
        type: user.type,
      },
    };
  }
}
