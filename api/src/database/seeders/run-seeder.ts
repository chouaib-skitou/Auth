import { DataSource } from 'typeorm';
import { seedRBAC } from './rbac.seeder';

async function runSeeder(): Promise<void> {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'spendwise',
    password: process.env.DB_PASSWORD || 'spendwise123',
    database: process.env.DB_DATABASE || 'spendwise_auth',
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('📦 Database connected');

    await seedRBAC(dataSource);
    console.log('✅ Seeding completed successfully!');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

void runSeeder();