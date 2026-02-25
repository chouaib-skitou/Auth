import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1709000000000 implements MigrationInterface {
  name = 'AddIndexes1709000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX idx_email_verification_token ON email_verification_tokens(token(255))`,
    );

    await queryRunner.query(
      `CREATE INDEX idx_password_reset_token ON password_reset_tokens(token(255))`,
    );

    await queryRunner.query(
      `CREATE INDEX idx_refresh_token ON refresh_tokens(token(255))`,
    );

    await queryRunner.query(
      `CREATE INDEX idx_refresh_token_active ON refresh_tokens(token(255), isRevoked, expiresAt)`,
    );

    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);

    await queryRunner.query(
      `CREATE INDEX idx_users_username ON users(username)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX idx_email_verification_token ON email_verification_tokens`,
    );
    await queryRunner.query(
      `DROP INDEX idx_password_reset_token ON password_reset_tokens`,
    );
    await queryRunner.query(`DROP INDEX idx_refresh_token ON refresh_tokens`);
    await queryRunner.query(
      `DROP INDEX idx_refresh_token_active ON refresh_tokens`,
    );
    await queryRunner.query(`DROP INDEX idx_users_email ON users`);
    await queryRunner.query(`DROP INDEX idx_users_username ON users`);
  }
}
