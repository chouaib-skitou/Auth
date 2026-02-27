import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { AccountLockoutService } from './account-lockout.service';
import { AccountLockoutListener } from './account-lockout.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      EmailVerificationToken,
      PasswordResetToken,
      LoginAttempt,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiration') as any,
        },
      }),
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AccountLockoutService,
    AccountLockoutListener,
  ],
  exports: [AuthService, AccountLockoutService],
})
export class AuthModule {}