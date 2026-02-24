import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailValidationService } from './email-validation.service';
import { ZeroBounceProvider } from './providers/zerobounce.provider';
import { DeepValidatorProvider } from './providers/deep-validator.provider';
import mailConfig from '../config/mail.config';
import emailValidationConfig from '../config/email-validation.config';

@Module({
  imports: [
    ConfigModule.forFeature(mailConfig),
    ConfigModule.forFeature(emailValidationConfig),
  ],
  providers: [
    MailService,
    EmailValidationService,
    ZeroBounceProvider,
    DeepValidatorProvider,
  ],
  exports: [MailService, EmailValidationService],
})
export class MailModule {}
