import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid password');
    const { password: _, ...result } = user;
    return result;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    // Create access token (short-lived)
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    // Create refresh token (long-lived)
    const refreshToken = randomBytes(64).toString('hex');
    await this.setRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    roleId: string;
  }) {
    const hashed = await bcrypt.hash(
      data.password,
      Number(process.env.BCRYPT_SALT_ROUNDS || 10),
    );
    const user = await this.prisma.user.create({
      data: { ...data, password: hashed },
    });
    const { password: _, ...rest } = user;
    return rest;
  }

  async setRefreshToken(userId: string, plainRefreshToken: string) {
    const hashed = await bcrypt.hash(plainRefreshToken, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });
  }

  async removeRefreshToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async validateRefreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken) return false;
    return bcrypt.compare(refreshToken, user.refreshToken);
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !(await this.validateRefreshToken(user.id, refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    return { accessToken };
  }
}
