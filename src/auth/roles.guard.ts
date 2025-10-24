import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    // adapt if you have user object inside a different property
    if (!user) throw new ForbiddenException('No user authenticated.');
    // Allow if user role name is included in requiredRoles
    const userRole = user.role?.name || user.roleName; // adjust as needed
    if (!userRole) throw new ForbiddenException('User has no role');

    if (requiredRoles.includes(userRole)) return true;

    throw new ForbiddenException(
      `Requires one of: ${requiredRoles.join(', ')}`,
    );
  }
}
