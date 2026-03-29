import { DataSource } from 'typeorm';
import { ExpenseCategory } from '../entities/expense-category.entity';

const SEED_CATEGORIES = [
  { name: 'Fournitures bureau', code: 'FOUR-BUR', budgetLimit: 500000 },
  { name: 'Transport', code: 'TRANSPORT', budgetLimit: 1000000 },
  { name: 'Maintenance', code: 'MAINT', budgetLimit: 750000 },
  { name: 'Salaires', code: 'SALAIRES', budgetLimit: 5000000 },
  { name: 'Charges sociales', code: 'CHG-SOC', budgetLimit: 2000000 },
  { name: 'Loyers', code: 'LOYERS', budgetLimit: 1500000 },
  { name: 'Énergie', code: 'ENERGIE', budgetLimit: 800000 },
  { name: 'Télécom', code: 'TELECOM', budgetLimit: 300000 },
  { name: 'Formation', code: 'FORMATION', budgetLimit: 600000 },
  { name: 'Divers', code: 'DIVERS', budgetLimit: 200000 },
];

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'caisseflow',
    password: process.env.POSTGRES_PASSWORD || 'caisseflow',
    database: process.env.POSTGRES_DB || 'caisseflow',
    entities: [ExpenseCategory],
    synchronize: false,
  });

  await ds.initialize();
  const repo = ds.getRepository(ExpenseCategory);

  for (const cat of SEED_CATEGORIES) {
    const exists = await repo.findOne({ where: { code: cat.code } });
    if (!exists) {
      await repo.save(
        repo.create({
          name: cat.name,
          code: cat.code,
          budgetLimit: cat.budgetLimit,
          parentId: null,
        }),
      );
      console.log(`  ✓ Created category: ${cat.name} (${cat.code})`);
    } else {
      console.log(`  – Category already exists: ${cat.name}`);
    }
  }

  await ds.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
