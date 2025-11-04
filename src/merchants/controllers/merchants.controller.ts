import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/services/jwt.service';

@Controller('merchants')
@UseGuards(JwtAuthGuard)
export class MerchantsController {
  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return { userId: user.sub, userName: user.userName };
  }

  @Get('balance')
  getBalance(@CurrentUser('sub') userId: string) {
    // Get balance for userId
  }
}
