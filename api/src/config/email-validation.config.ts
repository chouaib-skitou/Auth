import { registerAs } from '@nestjs/config';

export default registerAs('emailValidation', () => ({
  provider: process.env.EMAIL_VALIDATION_PROVIDER || 'deep-validator',
  zeroBounceApiKey: process.env.ZEROBOUNCE_API_KEY || '',
  enabled: process.env.EMAIL_VALIDATION_ENABLED === 'true',
}));