import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Admin } from '../schemas/admin.schema';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';
import { AdminResponseDto } from '../dto/admin-response.dto';
import { JwtService, TokenPair } from 'src/auth/services/jwt.service';

@Injectable()
export class AdminService {
  private readonly saltRounds = 10;

  constructor(
    @InjectModel(Admin.name)
    private adminModel: Model<Admin>,
    private jwtService: JwtService,
  ) {}

  /**
   * Create a new admin user
   */
  async create(createAdminDto: CreateAdminDto): Promise<AdminResponseDto> {
    // Check if username or email already exists
    const existing = await this.adminModel.findOne({
      $or: [
        { username: createAdminDto.username },
        { email: createAdminDto.email },
      ],
    });

    if (existing) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      createAdminDto.password,
      this.saltRounds,
    );

    const admin = new this.adminModel({
      ...createAdminDto,
      password: hashedPassword,
    });

    const saved = await admin.save();
    return this.toResponseDto(saved);
  }

  /**
   * Authenticate admin and return JWT tokens
   */
  async login(username: string, password: string): Promise<TokenPair> {
    const admin = await this.adminModel.findOne({ username, isActive: true });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.jwtService.generateTokenPair({
      sub: admin._id.toString(),
      userName: admin.username,
      type: 'admin',
      role: admin.role,
    });
  }

  /**
   * Get all admins
   */
  async findAll(): Promise<AdminResponseDto[]> {
    const admins = await this.adminModel.find().exec();
    return admins.map((admin) => this.toResponseDto(admin));
  }

  /**
   * Get admin by ID
   */
  async findById(id: string): Promise<AdminResponseDto> {
    const admin = await this.adminModel.findById(id);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return this.toResponseDto(admin);
  }

  /**
   * Update admin
   */
  async update(id: string, updateAdminDto: UpdateAdminDto): Promise<AdminResponseDto> {
    const admin = await this.adminModel.findById(id);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // If updating password, hash it
    if (updateAdminDto.password) {
      updateAdminDto.password = await bcrypt.hash(
        updateAdminDto.password,
        this.saltRounds,
      );
    }

    const updated = await this.adminModel.findByIdAndUpdate(
      id,
      updateAdminDto,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Admin not found');
    }

    return this.toResponseDto(updated);
  }

  /**
   * Deactivate admin
   */
  async deactivate(id: string): Promise<void> {
    await this.adminModel.findByIdAndUpdate(id, { isActive: false });
  }

  private toResponseDto(admin: Admin): AdminResponseDto {
    return {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}

