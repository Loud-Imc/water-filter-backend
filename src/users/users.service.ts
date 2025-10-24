import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ include: { role: true, region: true } });
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

  async update(id: string, dto: any) {
    if (dto.password) {
      dto.password = await bcrypt.hash(
        dto.password,
        Number(process.env.BCRYPT_SALT_ROUNDS || 10),
      );
    }
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

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
    console.log('get **** called')
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
    console.log('get **** called2', user.role.name)
    const assignableRoleNames = roleHierarchy[user.role.name] || [];

    return this.prisma.role.findMany({
      where: { name: { in: assignableRoleNames } },
    });
  }
}
