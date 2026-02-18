import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  emailVerificationExpiration:
    process.env.EMAIL_VERIFICATION_TOKEN_EXPIRATION || '1h',
  passwordResetExpiration: process.env.PASSWORD_RESET_TOKEN_EXPIRATION || '20m',
}));
