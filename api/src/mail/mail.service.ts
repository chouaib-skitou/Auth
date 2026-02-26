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
      user: this.configService.get<string>('mail.user', ''),
      password: this.configService.get<string>('mail.password', ''),
    };

    console.log('📧 Mail Config:', {
      host: mailConfig.host,
      port: mailConfig.port,
      user: mailConfig.user,
      hasPassword: !!mailConfig.password,
    });

    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: false, // Use STARTTLS
      auth:
        mailConfig.user && mailConfig.password
          ? {
              user: mailConfig.user,
              pass: mailConfig.password,
            }
          : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"${this.configService.get<string>('mail.fromName', 'Auth System')}" <${this.configService.get<string>('mail.from', 'noreply@yourdomain.com')}>`,
      to,
      subject,
      html,
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const apiUrl = this.configService.get<string>(
      'app.apiUrl',
      'http://localhost:3000',
    );
    const verificationUrl = `${apiUrl}/auth/verify-email/${token}`;

    await this.transporter.sendMail({
      from: `"${this.configService.get<string>('mail.fromName', 'Auth System')}" <${this.configService.get<string>('mail.from', 'noreply@yourdomain.com')}>`,
      to: email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome!</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Verify Email
          </a>
          <p>Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const apiUrl = this.configService.get<string>(
      'app.apiUrl',
      'http://localhost:3000',
    );
    const resetUrl = `${apiUrl}/auth/reset-password/${token}`;

    await this.transporter.sendMail({
      from: `"${this.configService.get<string>('mail.fromName', 'Auth System')}" <${this.configService.get<string>('mail.from', 'noreply@yourdomain.com')}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Password Reset</h1>
          <p>You requested to reset your password. Click the button below:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
          <p style="color: #666; font-size: 14px;">This link will expire in 20 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  async sendAccountLockedEmail(
    email: string,
    username: string,
    durationMinutes: number,
    ipAddress: string,
  ): Promise<void> {
    const subject = 'Security Alert: Account Locked';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Account Temporarily Locked</h2>
        <p>Hello ${username},</p>
        <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
        
        <h3>Details:</h3>
        <ul>
          <li><strong>IP Address:</strong> ${ipAddress}</li>
          <li><strong>Lock Duration:</strong> ${durationMinutes} minutes</li>
          <li><strong>Unlock Time:</strong> ${new Date(Date.now() + durationMinutes * 60000).toLocaleString()}</li>
        </ul>
        
        <p><strong>If this wasn't you:</strong> Please contact support immediately.</p>
        <p>Your account will automatically unlock in ${durationMinutes} minutes.</p>
        
        <p style="color: #666; font-size: 14px;">Best regards,<br>Security Team</p>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }
}
