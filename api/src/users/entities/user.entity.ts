import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
