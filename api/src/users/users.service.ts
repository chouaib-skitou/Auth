import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Role } from '../roles/entities/role.entity';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcrypt';
import { EmailValidationService } from '../mail/email-validation.service';

const ADMIN_ROLE = 'ADMIN';
const MANAGER_ROLE = 'MANAGER';
const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private authService: AuthService,
    private emailValidationService: EmailValidationService,
    private configService: ConfigService,
  ) {}

  private isAdmin(user: User): boolean {
    return user.roles?.some((r) => r.name === ADMIN_ROLE) ?? false;
  }

  private isAdminOrManager(user: User): boolean {
    return (
      user.roles?.some((r) => [ADMIN_ROLE, MANAGER_ROLE].includes(r.name)) ??
      false
    );
  }

  private isTargetAdminOrManager(targetUser: User): boolean {
    return (
      targetUser.roles?.some((r) =>
        [ADMIN_ROLE, MANAGER_ROLE].includes(r.name),
      ) ?? false
    );
  }

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

    const validationEnabled = this.configService.get<boolean>(
      'emailValidation.enabled',
      false,
    );

    if (validationEnabled) {
      const emailCheck = await this.emailValidationService.validateEmail(
        createUserDto.email,
      );

      if (this.emailValidationService.shouldBlock(emailCheck)) {
        throw new BadRequestException(`Invalid email: ${emailCheck.reason}`);
      }

      const suggestion = this.emailValidationService.getSuggestion(emailCheck);
      if (suggestion) {
        throw new BadRequestException(`Did you mean: ${suggestion}?`);
      }
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_ROUNDS,
    );

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

    return users.map((user) => this.mapToResponse(user));
  }

  async findOne(id: string, currentUser: User): Promise<UserResponseDto> {
    if (!this.isAdminOrManager(currentUser) && currentUser.id !== id) {
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
    if (!this.isAdminOrManager(currentUser) && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!this.isAdmin(currentUser) && this.isAdminOrManager(currentUser)) {
      if (this.isTargetAdminOrManager(user) && currentUser.id !== id) {
        throw new ForbiddenException(
          'Managers cannot update other managers or admins',
        );
      }
    }

    if (!this.isAdminOrManager(currentUser)) {
      const allowedFields = ['username', 'email'];
      const updateFields = Object.keys(updateUserDto);
      const hasInvalidFields = updateFields.some(
        (field) => !allowedFields.includes(field),
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
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        BCRYPT_ROUNDS,
      );
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string, currentUser: User): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!this.isAdmin(currentUser) && this.isAdminOrManager(currentUser)) {
      if (this.isTargetAdminOrManager(user)) {
        throw new ForbiddenException(
          'Managers cannot delete other managers or admins',
        );
      }
    }

    await this.usersRepository.remove(user);
    return { message: `User with ID ${id} successfully deleted` };
  }

  async assignRole(
    userId: string,
    roleName: string,
    currentUser: User,
  ): Promise<User> {
    return await this.usersRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const user = await transactionalEntityManager.findOne(User, {
          where: { id: userId },
          relations: ['roles', 'roles.permissions'],
        });

        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const role = await transactionalEntityManager.findOne(Role, {
          where: { name: roleName },
          relations: ['permissions'],
        });

        if (!role) {
          throw new NotFoundException(`Role ${roleName} not found`);
        }

        if (
          !this.isAdmin(currentUser) &&
          (roleName === ADMIN_ROLE || roleName === MANAGER_ROLE)
        ) {
          throw new ForbiddenException(
            'Only administrators can assign ADMIN or MANAGER roles',
          );
        }

        if (!this.isAdmin(currentUser) && currentUser.id === userId) {
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

        const savedUser = await transactionalEntityManager.save(User, user);
        return savedUser;
      },
    );
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
      roles: user.roles?.map((r) => r.name) || [],
      permissions:
        user.roles?.flatMap((r) => r.permissions?.map((p) => p.name)) || [],
    };
  }
}
