import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDefaultPermissionsForRole } from '../constants/permissions';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) return [];

    // ✅ Get default permissions for user's role
    const defaultPermissions = getDefaultPermissionsForRole(user.role.name);

    // ✅ Get custom permissions (now a flat array)
    const customPermissions = (user.customPermissions as string[]) || [];

    // ✅ Combine: Default permissions + Custom permissions
    // Using Set to avoid duplicates
    const allPermissions = new Set([
      ...defaultPermissions,
      ...customPermissions,
    ]);

    console.log('Default permissions:', defaultPermissions);
    console.log('Custom permissions:', customPermissions);
    console.log('All permissions:', Array.from(allPermissions));

    return Array.from(allPermissions);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const hasAccess = permissions.includes(permission);

    console.log(
      `User ${userId} checking permission: ${permission} - ${hasAccess ? 'ALLOWED' : 'DENIED'}`,
    );

    return hasAccess;
  }

  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    console.log('User permissions:', userPermissions);
    console.log('Required any of:', permissions);

    const hasAccess = permissions.some((perm) =>
      userPermissions.includes(perm),
    );

    console.log('Has any permission:', hasAccess);

    return hasAccess;
  }

  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    console.log('User permissions:', userPermissions);
    console.log('Required all of:', permissions);

    const hasAccess = permissions.every((perm) =>
      userPermissions.includes(perm),
    );

    console.log('Has all permissions:', hasAccess);

    return hasAccess;
  }

  // ✅ NEW: Check if a permission is a default for user's role
  async isDefaultPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) return false;

    const defaultPermissions = getDefaultPermissionsForRole(user.role.name);
    return defaultPermissions.includes(permission);
  }

  // ✅ NEW: Get permissions breakdown (defaults vs custom)
  async getPermissionsBreakdown(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return {
        defaultPermissions: [],
        customPermissions: [],
        allPermissions: [],
      };
    }

    const defaultPermissions = getDefaultPermissionsForRole(user.role.name);
    const allCustomPermissions = (user.customPermissions as string[]) || [];

    // Custom permissions are only those not in defaults
    const customPermissions = allCustomPermissions.filter(
      (p) => !defaultPermissions.includes(p),
    );

    return {
      defaultPermissions,
      customPermissions,
      allPermissions: Array.from(
        new Set([...defaultPermissions, ...allCustomPermissions]),
      ),
    };
  }
}
