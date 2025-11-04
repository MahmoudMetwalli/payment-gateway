import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminResponseDto } from '../dto/admin-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AdminRole } from '../schemas/admin.schema';
import { Public } from 'src/auth/decorators/public.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Merchant } from 'src/merchants/schemas/merchants.schema';
import { Transaction } from 'src/transactions/schemas/transaction.schema';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
  ) {}

  @Post('auth/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: AdminLoginDto) {
    return this.adminService.login(loginDto.username, loginDto.password);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'Create admin user (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Admin created', type: AdminResponseDto })
  async createAdmin(@Body() createAdminDto: CreateAdminDto): Promise<AdminResponseDto> {
    return this.adminService.create(createAdminDto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'List all admins' })
  @ApiResponse({ status: 200, description: 'List of admins', type: [AdminResponseDto] })
  async listAdmins(): Promise<AdminResponseDto[]> {
    return this.adminService.findAll();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'Get admin by ID' })
  @ApiResponse({ status: 200, description: 'Admin details', type: AdminResponseDto })
  async getAdmin(@Param('id') id: string): Promise<AdminResponseDto> {
    return this.adminService.findById(id);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'Update admin (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin updated', type: AdminResponseDto })
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ): Promise<AdminResponseDto> {
    return this.adminService.update(id, updateAdminDto);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate admin (Super Admin only)' })
  @ApiResponse({ status: 204, description: 'Admin deactivated' })
  async deactivateAdmin(@Param('id') id: string): Promise<void> {
    return this.adminService.deactivate(id);
  }

  @Get('merchants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'List all merchants' })
  @ApiResponse({ status: 200, description: 'List of merchants' })
  async listMerchants() {
    return this.merchantModel.find().select('-password -apiSecret').exec();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'List all transactions across all merchants' })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  async listTransactions() {
    return this.transactionModel.find().sort({ createdAt: -1 }).limit(100).exec();
  }

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('Admin-JWT-auth')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'System statistics' })
  async getDashboardStats() {
    const [merchantCount, transactionCount, transactionStats] = await Promise.all([
      this.merchantModel.countDocuments(),
      this.transactionModel.countDocuments(),
      this.transactionModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    return {
      merchantCount,
      transactionCount,
      transactionStats,
    };
  }
}

