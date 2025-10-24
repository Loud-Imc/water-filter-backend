import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Service Admin')
  register(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      roleId: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      body.email,
      body.password,
    );

    // ✅ Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // ✅ Only secure in production
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // ✅ Also send user ID (needed for refresh endpoint)
    return { accessToken, user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // ✅ Get refresh token from HttpOnly cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // ✅ Get userId from request body (sent by frontend)
    const { userId } = req.body;

    if (!userId) {
      throw new UnauthorizedException('User ID required');
    }

    console.log('🔄 Refreshing token for user:', userId);

    const result = await this.authService.refreshToken(userId, refreshToken);

    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const userId = req.user.userId;
    await this.authService.removeRefreshToken(userId);

    // ✅ Clear the HttpOnly cookie
    res.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }
}
