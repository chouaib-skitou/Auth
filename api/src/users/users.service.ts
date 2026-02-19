import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Role } from '../roles/entities/role.entity';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private authService: AuthService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUsername = await this.usersRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    await this.authService.sendVerificationEmail(savedUser.id);

    return savedUser;
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      relations: ['roles', 'roles.permissions'],
      select: ['id', 'username', 'email', 'isEmailVerified', 'createdAt', 'updatedAt'],
    });

    return users.map(user => this.mapToResponse(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
      select: ['id', 'username', 'email', 'isEmailVerified', 'emailVerifiedAt', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapToResponse(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.usersRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (existingUsername) {
        throw new ConflictException('Username already exists');
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.remove(user);
    return { message: `User with ID ${id} successfully deleted` };
  }

  async assignRole(userId: string, roleName: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const role = await this.usersRepository.manager.findOne(Role, {
      where: { name: roleName },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    if (!user.roles) {
      user.roles = [];
    }

    const hasRole = user.roles.some((r) => r.id === role.id);
    if (!hasRole) {
      user.roles.push(role);
      await this.usersRepository.save(user);
    }

    const updatedUser = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return updatedUser;
  }

  private mapToResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles?.map(r => r.name) || [],
      permissions: user.roles?.flatMap(r => r.permissions?.map(p => p.name)) || [],
    };
  }
}