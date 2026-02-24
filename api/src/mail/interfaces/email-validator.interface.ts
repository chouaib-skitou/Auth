export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
  isDisposable?: boolean;
  isCatchAll?: boolean;
  score?: number; // Quality score 0-100
}

export interface IEmailValidator {
  validate(email: string): Promise<EmailValidationResult>;
  validateBatch?(emails: string[]): Promise<EmailValidationResult[]>;
}
