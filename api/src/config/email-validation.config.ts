import { registerAs } from '@nestjs/config';

export default registerAs('emailValidation', () => ({
  provider: process.env.EMAIL_VALIDATION_PROVIDER || 'deep-validator',
  enabled: process.env.EMAIL_VALIDATION_ENABLED === 'true',

  // ZeroBounce Configuration
  zeroBounce: {
    apiKey: process.env.ZEROBOUNCE_API_KEY || '',
    apiUrl: process.env.ZEROBOUNCE_API_URL || 'https://api.zerobounce.net/v2',
  },
}));
