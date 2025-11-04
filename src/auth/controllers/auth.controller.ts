import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { JwtService, TokenPair } from '../services/jwt.service';
import { AuthDto } from '../dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() authDto: AuthDto): Promise<TokenPair> {
    return this.authService.merchantsSignIn(authDto);
  }

  @Public()
  @Post('refresh')
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
