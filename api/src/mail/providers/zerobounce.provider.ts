import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IEmailValidator,
  EmailValidationResult,
} from '../interfaces/email-validator.interface';

interface ZeroBounceResponse {
  status: string;
  sub_status?: string;
  did_you_mean?: string;
}

@Injectable()
export class ZeroBounceProvider implements IEmailValidator {
  private readonly logger = new Logger(ZeroBounceProvider.name);
  private readonly apiKey: string | null;
  private readonly apiUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('emailValidation.zeroBounce.apiKey') ||
      null;
    this.apiUrl = this.configService.get<string>(
      'emailValidation.zeroBounce.apiUrl',
    )!;

    if (this.apiKey) {
      this.logger.log(
        `ZeroBounce provider initialized with API: ${this.apiUrl}`,
      );
    } else {
      this.logger.warn('ZeroBounce API key not configured - provider disabled');
    }
  }

  async validate(email: string): Promise<EmailValidationResult> {
    if (!this.apiKey) {
      throw new Error('ZeroBounce provider not configured');
    }

    try {
      const url = `${this.apiUrl}/validate?api_key=${this.apiKey}&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ZeroBounce API error: ${response.statusText}`);
      }

      const data = (await response.json()) as ZeroBounceResponse;

      return {
        valid: data.status === 'valid',
        reason: this.mapStatus(data.status),
        suggestion: data.did_you_mean || undefined,
        isDisposable: data.sub_status === 'disposable',
        isCatchAll: data.sub_status === 'catch_all',
        score: this.calculateScore(data),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ZeroBounce validation error: ${errorMessage}`);
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

  private calculateScore(data: ZeroBounceResponse): number {
    if (data.status === 'valid') return 100;
    if (data.status === 'catch_all') return 70;
    if (data.status === 'unknown') return 50;
    return 0;
  }
}
