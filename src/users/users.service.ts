import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS } from '../constants/permissions';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ include: { role: true, region: true } });
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
              in: ['Service Technician', 'Senior Technician'],
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
    return user;
  }

  async create(dto: CreateUserDto) {
    console.log('dto":', dto);
    const hashedPassword = await bcrypt.hash(
      dto.password,
      Number(process.env.BCRYPT_SALT_ROUNDS || 10),
    );
    // Optionally validate roleId and regionId existence
    const newUser = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  // async update(id: string, dto: any) {
  //   if (dto.password) {
  //     dto.password = await bcrypt.hash(
  //       dto.password,
  //       Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  //     );
  //   }
  //   const updatedUser = await this.prisma.user.update({
  //     where: { id },
  //     data: dto,
  //   });
  //   const { password, ...userWithoutPassword } = updatedUser;
  //   return userWithoutPassword;
  // }

  async delete(id: string) {
    await this.findOne(id); // ensure exists
    await this.prisma.user.delete({ where: { id } });
  }

  // Get users created by a specific admin (subordinates)
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

  // Get all users under an admin's hierarchy (including nested subordinates)
  async getUsersInHierarchy(adminId: string) {
    const directSubordinates = await this.getUsersByCreator(adminId);

    // Recursively get subordinates of subordinates
    const allSubordinates = [...directSubordinates];

    for (const subordinate of directSubordinates) {
      const nestedSubordinates = await this.getUsersInHierarchy(subordinate.id);
      allSubordinates.push(...nestedSubordinates);
    }

    return allSubordinates;
  }

  // Check if user can manage another user
  async canManageUser(
    managerId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const manager = await this.findOne(managerId);
    const target = await this.findOne(targetUserId);

    // Super Admin can manage everyone
    if (manager.role.name === 'Super Admin') return true;

    // Check if target is in manager's hierarchy
    const subordinates = await this.getUsersInHierarchy(managerId);
    return subordinates.some((sub) => sub.id === targetUserId);
  }

  // Get available roles for a user to assign
  async getAssignableRoles(userId: string) {
    console.log('get **** called');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Define role hierarchy
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
    console.log('get **** called2', user.role.name);
    const assignableRoleNames = roleHierarchy[user.role.name] || [];

    return this.prisma.role.findMany({
      where: { name: { in: assignableRoleNames } },
    });
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get role permissions
    const rolePermissions = (user.role.permissions as any)?.permissions || [];

    // Get custom permissions
    const customPerms = user.customPermissions as any;
    const addedPermissions = customPerms?.add || [];
    const removedPermissions = customPerms?.remove || [];

    return {
      rolePermissions,
      customPermissions: {
        add: addedPermissions,
        remove: removedPermissions,
      },
      effectivePermissions: this.calculateEffectivePermissions(
        rolePermissions,
        addedPermissions,
        removedPermissions,
      ),
    };
  }

  async updateUserPermissions(
    userId: string,
    permissions: { add?: string[]; remove?: string[] },
  ) {
    // Validate permissions exist
    const validPermissions = ALL_PERMISSIONS.map((p) => p.key);

    if (permissions.add) {
      const invalidAdd = permissions.add.filter(
        (p) => !validPermissions.includes(p),
      );
      if (invalidAdd.length > 0) {
        throw new ForbiddenException(
          `Invalid permissions: ${invalidAdd.join(', ')}`,
        );
      }
    }

    if (permissions.remove) {
      const invalidRemove = permissions.remove.filter(
        (p) => !validPermissions.includes(p),
      );
      if (invalidRemove.length > 0) {
        throw new ForbiddenException(
          `Invalid permissions: ${invalidRemove.join(', ')}`,
        );
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        customPermissions: permissions,
      },
      include: { role: true, region: true },
    });
  }

  async getAvailablePermissions() {
    // Return all permissions grouped by module
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

  private calculateEffectivePermissions(
    rolePermissions: string[],
    addedPermissions: string[],
    removedPermissions: string[],
  ): string[] {
    const effective = new Set([...rolePermissions, ...addedPermissions]);
    removedPermissions.forEach((perm) => effective.delete(perm));
    return Array.from(effective);
  }

  // Update existing update method to handle permissions
  async update(id: string, dto: UpdateUserDto) {
    const updateData: any = { ...dto };

    // If password is being updated, hash it
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    // Handle custom permissions if provided
    if (dto.customPermissions) {
      updateData.customPermissions = dto.customPermissions;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true, region: true },
    });
  }
}
