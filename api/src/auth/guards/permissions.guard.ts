import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user: User = request.user;

    if (!user || !user.roles) {
      return false;
    }

    const userPermissions = user.roles.flatMap(
      (role) => role.permissions?.map((perm) => perm.name) || [],
    );

    return requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }
}
