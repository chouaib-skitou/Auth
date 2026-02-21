import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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

  async create(
    createUserDto: CreateUserDto,
    currentUser?: User,
  ): Promise<User> {
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
      select: [
        'id',
        'username',
        'email',
        'isEmailVerified',
        'createdAt',
        'updatedAt',
      ],
    });

    return users.map(user => this.mapToResponse(user));
  }

  async findOne(id: string, currentUser: User): Promise<UserResponseDto> {
    // Check if user is trying to access someone else's profile
    const userRoles = currentUser.roles?.map(r => r.name) || [];
    const isAdminOrManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');

    if (!isAdminOrManager && currentUser.id !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
      select: [
        'id',
        'username',
        'email',
        'isEmailVerified',
        'emailVerifiedAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapToResponse(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ): Promise<User> {
    const userRoles = currentUser.roles?.map(r => r.name) || [];
    const isAdminOrManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');

    // Check if user is trying to update someone else
    if (!isAdminOrManager && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // MANAGER cannot update other MANAGERs or ADMINs
    if (userRoles.includes('MANAGER') && !userRoles.includes('ADMIN')) {
      const targetUserRoles = user.roles?.map((r) => r.name) || [];
      const targetIsManagerOrAdmin =
        targetUserRoles.includes('MANAGER') ||
        targetUserRoles.includes('ADMIN');

      if (targetIsManagerOrAdmin && currentUser.id !== id) {
        throw new ForbiddenException(
          'Managers cannot update other managers or admins',
        );
      }
    }

    // Regular users can only update username and email
    if (!isAdminOrManager) {
      const allowedFields = ['username', 'email'];
      const updateFields = Object.keys(updateUserDto);
      const hasInvalidFields = updateFields.some(
        (field) => !allowedFields.includes(field), // ← Fixed: removed extra )
      );

      if (hasInvalidFields) {
        throw new ForbiddenException('You can only update username and email');
      }
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

  async remove(id: string, currentUser: User): Promise<{ message: string }> {
    const userRoles = currentUser.roles?.map(r => r.name) || [];
    const isAdmin = userRoles.includes('ADMIN');

    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // MANAGER cannot delete other MANAGERs or ADMINs
    if (userRoles.includes('MANAGER') && !isAdmin) {
      const targetUserRoles = user.roles?.map(r => r.name) || [];
      const targetIsManagerOrAdmin = targetUserRoles.includes('MANAGER') || targetUserRoles.includes('ADMIN');
      
      if (targetIsManagerOrAdmin) {
        throw new ForbiddenException('Managers cannot delete other managers or admins');
      }
    }

    await this.usersRepository.remove(user);
    return { message: `User with ID ${id} successfully deleted` };
  }

  async assignRole(
    userId: string,
    roleName: string,
    currentUser: User, // ← Add this parameter
  ): Promise<User> {
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

    // Check if current user is MANAGER trying to assign MANAGER or ADMIN role
    const currentUserRoles = currentUser.roles?.map((r) => r.name) || [];
    const isAdmin = currentUserRoles.includes('ADMIN');

    // Only ADMIN can assign ADMIN or MANAGER roles
    if (!isAdmin && (roleName === 'ADMIN' || roleName === 'MANAGER')) {
      throw new ForbiddenException(
        'Only administrators can assign ADMIN or MANAGER roles',
      );
    }

    // Prevent users from assigning roles to themselves (except ADMIN)
    if (!isAdmin && currentUser.id === userId) {
      throw new ForbiddenException('You cannot assign roles to yourself');
    }

    if (!user.roles) {
      user.roles = [];
    }

    const hasRole = user.roles.some((r) => r.id === role.id);
    if (hasRole) {
      throw new ConflictException(`User already has the ${roleName} role`);
    }

    user.roles.push(role);
    await this.usersRepository.save(user);

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