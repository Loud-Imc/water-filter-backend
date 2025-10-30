import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) return [];

    // Start with role permissions
    const rolePermissions = (user.role.permissions as any)?.permissions || [];

    // Get custom permissions
    const customPerms = user.customPermissions as any;
    const addedPermissions = customPerms?.add || [];
    const removedPermissions = customPerms?.remove || [];

    // Combine: Role permissions + Added - Removed
    const allPermissions = new Set([...rolePermissions, ...addedPermissions]);

    // Remove revoked permissions
    removedPermissions.forEach((perm: string) => allPermissions.delete(perm));

    return Array.from(allPermissions);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((perm) => userPermissions.includes(perm));
  }

  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((perm) => userPermissions.includes(perm));
  }
}
