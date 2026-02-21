import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard'; // ← Add this
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator'; // ← Add this
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // ← Add PermissionsGuard
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('CREATE_USERS')
  @ApiOperation({
    summary: 'Create a new user (requires CREATE_USERS permission)',
  })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Missing CREATE_USERS permission',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Permissions('READ_USERS')
  @ApiOperation({ summary: 'Get all users (requires READ_USERS permission)' })
  @ApiResponse({
    status: 200,
    description: 'List of all users',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Missing READ_USERS permission',
  })
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by ID (own profile or READ_USERS permission)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only view own profile',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user (own profile or UPDATE_USERS permission)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User successfully updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('DELETE_USERS')
  @ApiOperation({ summary: 'Delete a user (requires DELETE_USERS permission)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 204, description: 'User successfully deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Missing DELETE_USERS permission',
  })
  remove(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.usersService.remove(id, currentUser);
  }

  @Post(':userId/roles/:roleName')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign role to user (ADMIN only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({
    name: 'roleName',
    description: 'Role name (ADMIN, MANAGER, USER, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  @ApiResponse({ status: 409, description: 'User already has this role' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot assign ADMIN/MANAGER roles',
  })
  assignRole(
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.assignRole(userId, roleName, currentUser);
  }
}
