import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import securityConfig from './config/security.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig, securityConfig], // ✅ Added security config
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbConfig = configService.get<TypeOrmModuleOptions>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }
        return dbConfig;
      },
    }),
    UsersModule,
    RolesModule,
    PermissionsModule,
    AuthModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
