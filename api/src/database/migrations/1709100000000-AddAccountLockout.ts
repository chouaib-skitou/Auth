import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountLockout1709100000000 implements MigrationInterface {
  name = 'AddAccountLockout1709100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN failedLoginAttempts INT DEFAULT 0,
      ADD COLUMN isLocked BOOLEAN DEFAULT FALSE,
      ADD COLUMN lockedUntil DATETIME NULL
    `);

    await queryRunner.query(`
      CREATE TABLE login_attempts (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        ipAddress VARCHAR(45) NOT NULL,
        successful BOOLEAN DEFAULT FALSE,
        attemptedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_login_attempts_user_date 
      ON login_attempts(userId, attemptedAt DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX idx_login_attempts_user_date ON login_attempts`,
    );
    await queryRunner.query(`DROP TABLE login_attempts`);
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN failedLoginAttempts,
      DROP COLUMN isLocked,
      DROP COLUMN lockedUntil
    `);
  }
}