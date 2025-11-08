import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  getDefaultPermissionsForRole,
  isDefaultPermission,
} from '../constants/permissions';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: { role: true, region: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchTechnicians(
    query: string,
    regionId?: string,
    limit: number = 20,
  ) {
    const whereClause: any = {
      AND: [
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
          ],
        },
        {
          role: {
            name: {
              in: ['Technician', 'Service Technician', 'Senior Technician'],
            },
          },
        },
        { status: 'ACTIVE' },
      ],
    };

    if (regionId) {
      whereClause.AND.push({ regionId });
    }

    return this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, region: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(dto: CreateUserDto) {
    console.log('Creating user with dto:', dto);

    // Hash password
    const hashedPassword = await bcrypt.hash(
      dto.password,
      Number(process.env.BCRYPT_SALT_ROUNDS || 10),
    );

    // Get role information
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new BadRequestException('Invalid role selected');
    }

    // ✅ Get default permissions for this role
    const defaultPermissions = getDefaultPermissionsForRole(role.name);
    console.log(`Default permissions for ${role.name}:`, defaultPermissions);

    // ✅ Merge custom permissions with default permissions
    let finalPermissions: string[] = [...defaultPermissions];

    if (dto.customPermissions && Array.isArray(dto.customPermissions)) {
      // Add custom permissions (avoiding duplicates)
      finalPermissions = [
        ...new Set([...finalPermissions, ...dto.customPermissions]),
      ];
    }

    console.log('Final permissions:', finalPermissions);

    // Create user with permissions stored as array
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        roleId: dto.roleId,
        regionId: dto.regionId,
        isExternal: dto.isExternal || false,
        createdById: dto.createdById,
        status: 'ACTIVE',
        // ✅ Store as JSON array in customPermissions field
        customPermissions: finalPermissions,
      },
      include: {
        role: true,
        region: true,
      },
    });

    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      regionId: dto.regionId,
      status: dto.status,
      isExternal: dto.isExternal,
    };

    // ✅ If role is changing, recalculate permissions
    if (dto.roleId && dto.roleId !== user.roleId) {
      const newRole = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });

      if (!newRole) {
        throw new BadRequestException('Invalid role selected');
      }

      const newDefaultPermissions = getDefaultPermissionsForRole(newRole.name);
      const existingPermissions = (user.customPermissions as string[]) || [];

      // Merge new role defaults with existing custom permissions
      updateData.customPermissions = [
        ...new Set([...newDefaultPermissions, ...existingPermissions]),
      ];
      updateData.roleId = dto.roleId;

      console.log(
        `Role changed from ${user.role.name} to ${newRole.name}, updated permissions:`,
        updateData.customPermissions,
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
        region: true,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async updateUserPermissions(
    userId: string,
    changes: { add?: string[]; remove?: string[] },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Get default permissions for user's role
    const defaultPermissions = getDefaultPermissionsForRole(user.role.name);
    console.log('Default permissions for role:', defaultPermissions);

    // Validate permissions
    const validPermissions = ALL_PERMISSIONS.map((p) => p.key);
    const toAdd = changes.add || [];
    const toRemove = changes.remove || [];

    // Validate add permissions
    const invalidAdd = toAdd.filter((p) => !validPermissions.includes(p));
    if (invalidAdd.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidAdd.join(', ')}`,
      );
    }

    // Validate remove permissions
    const invalidRemove = toRemove.filter((p) => !validPermissions.includes(p));
    if (invalidRemove.length > 0) {
      throw new BadRequestException(
        `Invalid permissions: ${invalidRemove.join(', ')}`,
      );
    }

    // ✅ Filter out any attempts to remove default permissions
    const safeRemove = toRemove.filter(
      (perm) => !defaultPermissions.includes(perm),
    );

    if (safeRemove.length !== toRemove.length) {
      const blockedRemovals = toRemove.filter((p) =>
        defaultPermissions.includes(p),
      );
      console.warn(
        'Attempted to remove default permissions (blocked):',
        blockedRemovals,
      );
    }

    // Get current permissions
    let currentPermissions = (user.customPermissions as string[]) || [];

    // Add new permissions
    currentPermissions = [...currentPermissions, ...toAdd];

    // Remove non-default permissions
    currentPermissions = currentPermissions.filter(
      (p) => !safeRemove.includes(p),
    );

    // ✅ Ensure all default permissions are always present
    currentPermissions = [
      ...new Set([...defaultPermissions, ...currentPermissions]),
    ];

    console.log('Final permissions after update:', currentPermissions);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { customPermissions: currentPermissions },
      include: {
        role: true,
        region: true,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Get default permissions for the role
    const defaultPermissions = getDefaultPermissionsForRole(user.role.name);

    // Get all custom permissions (which includes defaults + added)
    const allPermissions = (user.customPermissions as string[]) || [];

    // Calculate which permissions were added beyond defaults
    const addedPermissions = allPermissions.filter(
      (p) => !defaultPermissions.includes(p),
    );

    return {
      roleName: user.role.name,
      defaultPermissions, // ✅ Permissions that come with the role (cannot be removed)
      addedPermissions, // ✅ Permissions added on top of defaults
      allPermissions, // ✅ Complete list of permissions user has
      effectivePermissions: allPermissions, // For backward compatibility
    };
  }

  async getAvailablePermissions() {
    const grouped = ALL_PERMISSIONS.reduce(
      (acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      },
      {} as Record<string, typeof ALL_PERMISSIONS>,
    );

    return {
      all: ALL_PERMISSIONS,
      byModule: grouped,
    };
  }

  async resetUserPassword(userId: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, and number',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return {
      message: 'Password reset successfully',
      user: updatedUser,
    };
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async getUsersByCreator(creatorId: string) {
    return this.prisma.user.findMany({
      where: { createdById: creatorId },
      include: {
        role: true,
        region: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUsersInHierarchy(adminId: string) {
    const directSubordinates = await this.getUsersByCreator(adminId);
    const allSubordinates = [...directSubordinates];

    for (const subordinate of directSubordinates) {
      const nestedSubordinates = await this.getUsersInHierarchy(subordinate.id);
      allSubordinates.push(...nestedSubordinates);
    }

    return allSubordinates;
  }

  async canManageUser(
    managerId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const manager = await this.findOne(managerId);
    const target = await this.findOne(targetUserId);

    if (manager.role.name === 'Super Admin') return true;

    const subordinates = await this.getUsersInHierarchy(managerId);
    return subordinates.some((sub) => sub.id === targetUserId);
  }

  async getAssignableRoles(userId: string) {
    console.log('getAssignableRoles called for user:', userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleHierarchy = {
      'Super Admin': [
        'Service Admin',
        'Sales Admin',
        'Service Manager',
        'Sales Manager',
        'Service Team Lead',
        'Sales Team Lead',
        'Technician',
        'Salesman',
      ],
      'Service Admin': ['Service Manager', 'Service Team Lead', 'Technician'],
      'Sales Admin': ['Sales Manager', 'Sales Team Lead', 'Salesman'],
      'Service Manager': ['Service Team Lead', 'Technician'],
      'Sales Manager': ['Sales Team Lead', 'Salesman'],
      'Service Team Lead': ['Technician'],
      'Sales Team Lead': ['Salesman'],
    };

    const assignableRoleNames = roleHierarchy[user.role.name] || [];

    return this.prisma.role.findMany({
      where: { name: { in: assignableRoleNames } },
    });
  }
}
