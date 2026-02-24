import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailValidator, EmailValidationResult } from '../interfaces/email-validator.interface';

@Injectable()
export class ZeroBounceProvider implements IEmailValidator {
  private readonly logger = new Logger(ZeroBounceProvider.name);
  private apiKey: string | null = null;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('emailValidation.zeroBounceApiKey') || null;
    
    if (this.apiKey) {
      this.logger.log('ZeroBounce provider initialized');
    } else {
      this.logger.warn('ZeroBounce API key not configured - provider disabled');
    }
  }

  async validate(email: string): Promise<EmailValidationResult> {
    if (!this.apiKey) {
      throw new Error('ZeroBounce provider not configured');
    }

    try {
      // Make HTTP request to ZeroBounce API
      const response = await fetch(
        `https://api.zerobounce.net/v2/validate?api_key=${this.apiKey}&email=${encodeURIComponent(email)}`,
      );

      if (!response.ok) {
        throw new Error(`ZeroBounce API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        valid: data.status === 'valid',
        reason: this.mapStatus(data.status),
        suggestion: data.did_you_mean || undefined,
        isDisposable: data.sub_status === 'disposable',
        isCatchAll: data.sub_status === 'catch_all',
        score: this.calculateScore(data),
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

  private calculateScore(data: any): number {
    if (data.status === 'valid') return 100;
    if (data.status === 'catch_all') return 70;
    if (data.status === 'unknown') return 50;
    return 0;
  }
}