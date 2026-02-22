import { Injectable, Logger } from '@nestjs/common';
import { IEmailValidator, EmailValidationResult } from '../interfaces/email-validator.interface';
import { validate } from 'deep-email-validator';

@Injectable()
export class DeepValidatorProvider implements IEmailValidator {
  private readonly logger = new Logger(DeepValidatorProvider.name);

  async validate(email: string): Promise<EmailValidationResult> {
    try {
      const result = await validate({
        email,
        validateRegex: true,
        validateMx: true,
        validateTypo: false,
        validateDisposable: true,
        validateSMTP: false,
      });

      return {
        valid: result.valid,
        reason: result.reason || undefined,
        isDisposable: result.validators?.disposable?.valid === false,
        score: result.valid ? 80 : 0,
      };
    } catch (error) {
      this.logger.error(`Deep validator error: ${error.message}`);
      throw error;
    }
  }
}