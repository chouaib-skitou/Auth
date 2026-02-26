import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../users/entities/user.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

export interface LoginAttemptResult {
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
  shouldNotify: boolean;
}

@Injectable()
export class AccountLockoutService {
  private readonly MAX_ATTEMPTS: number;
  private readonly LOCKOUT_DURATION_MINUTES: number;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(LoginAttempt)
    private loginAttemptsRepository: Repository<LoginAttempt>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.MAX_ATTEMPTS = this.configService.get<number>(
      'security.maxLoginAttempts',
      5,
    );
    this.LOCKOUT_DURATION_MINUTES = this.configService.get<number>(
      'security.lockoutDurationMinutes',
      30,
    );
  }

  async recordFailedAttempt(
    userId: string,
    ipAddress: string,
  ): Promise<LoginAttemptResult> {
    return await this.usersRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const user = await transactionalEntityManager.findOne(User, {
          where: { id: userId },
        });

        if (!user) {
          return {
            isLocked: false,
            remainingAttempts: this.MAX_ATTEMPTS,
            shouldNotify: false,
          };
        }

        await transactionalEntityManager.save(LoginAttempt, {
          userId,
          ipAddress,
          successful: false,
        });

        user.failedLoginAttempts += 1;

        const remainingAttempts = Math.max(
          0,
          this.MAX_ATTEMPTS - user.failedLoginAttempts,
        );

        if (user.failedLoginAttempts >= this.MAX_ATTEMPTS) {
          const lockUntil = new Date();
          lockUntil.setMinutes(
            lockUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES,
          );

          user.isLocked = true;
          user.lockedUntil = lockUntil;

          await transactionalEntityManager.save(User, user);

          this.eventEmitter.emit('account.locked', {
            userId: user.id,
            email: user.email,
            username: user.username,
            ipAddress,
            lockDurationMinutes: this.LOCKOUT_DURATION_MINUTES,
            lockedUntil: lockUntil,
          });

          return {
            isLocked: true,
            remainingAttempts: 0,
            lockedUntil: lockUntil,
            shouldNotify: true,
          };
        }

        await transactionalEntityManager.save(User, user);

        return {
          isLocked: false,
          remainingAttempts,
          shouldNotify: false,
        };
      },
    );
  }

  async recordSuccessfulAttempt(
    userId: string,
    ipAddress: string,
  ): Promise<void> {
    await this.usersRepository.manager.transaction(
      async (transactionalEntityManager) => {
        await transactionalEntityManager.save(LoginAttempt, {
          userId,
          ipAddress,
          successful: true,
        });

        await transactionalEntityManager.update(User, userId, {
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: undefined,
        });
      },
    );
  }

  async checkAccountStatus(userId: string): Promise<LoginAttemptResult> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      return {
        isLocked: false,
        remainingAttempts: this.MAX_ATTEMPTS,
        shouldNotify: false,
      };
    }

    if (user.isLocked && user.lockedUntil) {
      if (new Date() > user.lockedUntil) {
        await this.unlockAccount(userId);
        return {
          isLocked: false,
          remainingAttempts: this.MAX_ATTEMPTS,
          shouldNotify: false,
        };
      }

      return {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: user.lockedUntil,
        shouldNotify: false,
      };
    }

    const remainingAttempts = Math.max(
      0,
      this.MAX_ATTEMPTS - user.failedLoginAttempts,
    );

    return {
      isLocked: false,
      remainingAttempts,
      shouldNotify: false,
    };
  }

  async unlockAccount(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      failedLoginAttempts: 0,
      isLocked: false,
      lockedUntil: undefined,
    });

    this.eventEmitter.emit('account.unlocked', { userId });
  }

  async getLoginHistory(
    userId: string,
    limit: number = 10,
  ): Promise<LoginAttempt[]> {
    return this.loginAttemptsRepository.find({
      where: { userId },
      order: { attemptedAt: 'DESC' },
      take: limit,
    });
  }
}