import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IEmailValidator,
  EmailValidationResult,
} from './interfaces/email-validator.interface';
import { ZeroBounceProvider } from './providers/zerobounce.provider';
import { DeepValidatorProvider } from './providers/deep-validator.provider';

@Injectable()
export class EmailValidationService {
  private readonly logger = new Logger(EmailValidationService.name);
  private readonly provider: IEmailValidator;

  constructor(
    private configService: ConfigService,
    private zeroBounceProvider: ZeroBounceProvider,
    private deepValidatorProvider: DeepValidatorProvider,
  ) {
    // Choose provider based on config
    const providerName = this.configService.get<string>(
      'emailValidation.provider',
      'deep-validator',
    );

    this.provider = this.getProvider(providerName);
    this.logger.log(`Email validation provider: ${providerName}`);
  }

  private getProvider(providerName: string): IEmailValidator {
    const providers: Record<string, IEmailValidator> = {
      zerobounce: this.zeroBounceProvider,
      'deep-validator': this.deepValidatorProvider,
    };

    return providers[providerName] || this.deepValidatorProvider;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    try {
      return await this.provider.validate(email);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email validation failed: ${errorMessage}`);

      return {
        valid: this.isValidFormat(email),
        reason: 'Provider unavailable, basic validation only',
      };
    }
  }

  private isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Helper method for typo suggestions
  getSuggestion(result: EmailValidationResult): string | null {
    return result.suggestion || null;
  }

  // Helper method to check if should block
  shouldBlock(result: EmailValidationResult): boolean {
    return !result.valid || result.isDisposable === true;
  }
}
