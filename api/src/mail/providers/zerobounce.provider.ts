import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailValidator, EmailValidationResult } from '../interfaces/email-validator.interface';
import * as zerobounceSdk from '@zerobounce/zero-bounce-sdk';

@Injectable()
export class ZeroBounceProvider implements IEmailValidator {
  private readonly logger = new Logger(ZeroBounceProvider.name);
  private initialized = false;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('emailValidation.zeroBounceApiKey');
    if (apiKey) {
      zerobounceSdk.init(apiKey);
      this.initialized = true;
      this.logger.log('ZeroBounce provider initialized');
    } else {
      this.logger.warn('ZeroBounce API key not configured');
    }
  }

  async validate(email: string): Promise<EmailValidationResult> {
    if (!this.initialized) {
      throw new Error('ZeroBounce provider not initialized');
    }

    try {
      const response = await zerobounceSdk.validate(email);

      return {
        valid: response.status === 'valid',
        reason: this.mapStatus(response.status),
        suggestion: response.did_you_mean || undefined,
        isDisposable: response.sub_status === 'disposable',
        isCatchAll: response.sub_status === 'catch_all',
        score: this.calculateScore(response),
      };
    } catch (error) {
      this.logger.error(`ZeroBounce validation error: ${error.message}`);
      throw error;
    }
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      valid: 'Email is valid',
      invalid: 'Email is invalid',
      catch_all: 'Domain accepts all emails',
      unknown: 'Cannot verify',
      spamtrap: 'Email is a spam trap',
      abuse: 'Email is known for abuse',
      do_not_mail: 'Do not send to this email',
    };
    return statusMap[status] || 'Unknown status';
  }

  private calculateScore(response: any): number {
    if (response.status === 'valid') return 100;
    if (response.status === 'catch_all') return 70;
    if (response.status === 'unknown') return 50;
    return 0;
  }
}