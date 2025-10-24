import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(data: CreateRoleDto) {
    return this.prisma.role.create({ data });
  }

  async update(id: string, data: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.immutable)
      throw new BadRequestException('Cannot update immutable role');
    return this.prisma.role.update({ where: { id }, data });
  }

  async remove(id: string) {
    console.log('id;l;asdk', id)
    const role = await this.findOne(id);
    console.log('id;l;asdk', role)

    if (role.immutable)
      throw new BadRequestException('Cannot delete immutable role');
    return this.prisma.role.delete({ where: { id } });
  }
}
