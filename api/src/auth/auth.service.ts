import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationRepository: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private passwordResetRepository: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
      if (!refreshSecret) {
        throw new Error('Refresh secret not configured');
      }
      this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        token: refreshToken,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user', 'user.roles', 'user.roles.permissions'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    return this.generateTokens(storedToken.user);
  }

  private async generateTokens(user: User): Promise<AuthResponseDto> {
    const roles = user.roles?.map((role) => role.name) || [];
    const permissions =
      user.roles?.flatMap((role) =>
        role.permissions?.map((perm) => perm.name),
      ) || [];

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
    };

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const accessExpiration =
      this.configService.get<string>('jwt.accessExpiration') || '15m';
    const refreshExpiration =
      this.configService.get<string>('jwt.refreshExpiration') || '7d';

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    const accessExpiresIn = this.parseExpirationToSeconds(accessExpiration);
    const refreshExpiresIn = this.parseExpirationToSeconds(refreshExpiration);

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      },
    );

    const refreshTokenExpiration = new Date();
    refreshTokenExpiration.setSeconds(
      refreshTokenExpiration.getSeconds() + refreshExpiresIn,
    );

    await this.refreshTokenRepository.save({
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiration,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      tokenType: 'Bearer',
    };
  }

  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900; // 15 minutes default
    }
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokenBytes = this.configService.get<number>(
      'security.tokenBytes',
      32,
    );
    const expirationHours = this.configService.get<number>(
      'security.emailVerificationHours',
      1,
    );

    const token = crypto.randomBytes(tokenBytes).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    await this.emailVerificationRepository.save({
      token,
      userId: user.id,
      expiresAt,
    });

    await this.mailService.sendVerificationEmail(user.email, token);
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    const tokenRecord = await this.emailVerificationRepository.findOne({
      where: { token: verifyEmailDto.token, isUsed: false },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Token expired');
    }

    tokenRecord.user.isEmailVerified = true;
    tokenRecord.user.emailVerifiedAt = new Date();
    await this.usersRepository.save(tokenRecord.user);

    tokenRecord.isUsed = true;
    await this.emailVerificationRepository.save(tokenRecord);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(
    resendDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email: resendDto.email },
    });

    if (!user) {
      return {
        message: 'If the email exists, verification email has been sent',
      };
    }

    if (user.isEmailVerified) {
      throw new UnauthorizedException('Email already verified');
    }

    await this.sendVerificationEmail(user.id);

    return { message: 'Verification email sent' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      return {
        message: 'If the email exists, password reset email has been sent',
      };
    }

    const tokenBytes = this.configService.get<number>(
      'security.tokenBytes',
      32,
    );
    const expirationMinutes = this.configService.get<number>(
      'security.passwordResetMinutes',
      20,
    );

    const token = crypto.randomBytes(tokenBytes).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    await this.passwordResetRepository.save({
      token,
      userId: user.id,
      expiresAt,
    });

    await this.mailService.sendPasswordResetEmail(user.email, token);

    return { message: 'Password reset email sent' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const tokenRecord = await this.passwordResetRepository.findOne({
      where: { token: resetPasswordDto.token, isUsed: false },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Token expired');
    }

    const bcryptRounds = this.configService.get<number>(
      'security.bcryptRounds',
      10,
    );
    const hashedPassword = await bcrypt.hash(
      resetPasswordDto.newPassword,
      bcryptRounds,
    );

    tokenRecord.user.password = hashedPassword;
    await this.usersRepository.save(tokenRecord.user);

    tokenRecord.isUsed = true;
    await this.passwordResetRepository.save(tokenRecord);

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const bcryptRounds = this.configService.get<number>(
      'security.bcryptRounds',
      10,
    );
    const hashedPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      bcryptRounds,
    );

    user.password = hashedPassword;
    await this.usersRepository.save(user);

    return { message: 'Password changed successfully' };
  }
}
