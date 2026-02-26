import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from '../mail/mail.service';

export interface AccountLockedEvent {
  userId: string;
  email: string;
  username: string;
  ipAddress: string;
  lockDurationMinutes: number;
  lockedUntil: Date;
}

export interface AccountUnlockedEvent {
  userId: string;
}

@Injectable()
export class AccountLockoutListener {
  constructor(private mailService: MailService) {}

  @OnEvent('account.locked')
  async handleAccountLocked(event: AccountLockedEvent): Promise<void> {
    try {
      await this.mailService.sendAccountLockedEmail(
        event.email,
        event.username,
        event.lockDurationMinutes,
        event.ipAddress,
      );
    } catch (error) {
      console.error('Failed to send account locked email:', error);
    }
  }

  @OnEvent('account.unlocked')
  async handleAccountUnlocked(event: AccountUnlockedEvent): Promise<void> {
    console.log(`Account ${event.userId} has been unlocked`);
  }
}