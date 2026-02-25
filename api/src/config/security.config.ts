import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  tokenBytes: parseInt(process.env.TOKEN_BYTES || '32', 10),
  emailVerificationHours: parseInt(
    process.env.EMAIL_VERIFICATION_HOURS || '1',
    10,
  ),
  passwordResetMinutes: parseInt(
    process.env.PASSWORD_RESET_MINUTES || '20',
    10,
  ),
}));
