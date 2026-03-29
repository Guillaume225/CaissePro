import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedAll } from './seed-data';

async function run() {
  console.log('Connecting to database...');
  const ds = await AppDataSource.initialize();
  console.log('Running seed...');
  await seedAll(ds);
  console.log('Seed complete.');
  await ds.destroy();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
