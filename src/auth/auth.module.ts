import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { JwtService as CustomJwtService } from './services/jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}), // Configuration done in JwtService
    MerchantsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, CustomJwtService, JwtStrategy],
  exports: [CustomJwtService],
})
export class AuthModule {}
