import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required - allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      console.log('❌ PermissionsGuard: No user found');
      return false;
    }

    // ✅ NEW: Super Admin always has access (bypass permission check)
    if (user.roleName === 'Super Admin') {
      console.log('✅ PermissionsGuard: Super Admin - auto allowed');
      return true;
    }

    // Check if user has ANY of the required permissions
    const hasPermission = await this.permissionsService.hasAnyPermission(
      user.userId,
      requiredPermissions,
    );

    if (!hasPermission) {
      console.log(
        `❌ PermissionsGuard: User ${user.email} (${user.roleName}) denied - missing: [${requiredPermissions.join(', ')}]`,
      );
    } else {
      console.log(
        `✅ PermissionsGuard: User ${user.email} (${user.roleName}) allowed - has required permissions`,
      );
    }

    return hasPermission;
  }
}
