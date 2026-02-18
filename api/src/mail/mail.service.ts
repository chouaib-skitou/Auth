import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const mailConfig = {
      host: this.configService.get<string>('mail.host', 'localhost'),
      port: this.configService.get<number>('mail.port', 1025),
    };

    console.log('📧 Mail Config:', mailConfig);

    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: false,
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const apiUrl = this.configService.get<string>('app.apiUrl', 'http://localhost:3000');
    const verificationUrl = `${apiUrl}/auth/verify-email/${token}`;

    await this.transporter.sendMail({
      from: '"SpendWise" <noreply@spendwise.com>',
      to: email,
      subject: 'Verify your email address',
      html: `
        <h1>Welcome to SpendWise!</h1>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
        <p>Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const apiUrl = this.configService.get<string>('app.apiUrl', 'http://localhost:3000');
    const resetUrl = `${apiUrl}/auth/reset-password/${token}`;

    await this.transporter.sendMail({
      from: '"SpendWise" <noreply@spendwise.com>',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested to reset your password. Click the button below:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 20 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }
}