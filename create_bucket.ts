import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    // Attempt to create the bucket
    await prisma.$executeRawUnsafe(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('uploads', 'uploads', true) 
      ON CONFLICT DO NOTHING;
    `);
    console.log('Bucket "uploads" created or already exists.');

    // Attempt to create RLS policies
    try {
      await prisma.$executeRawUnsafe(`
        CREATE POLICY "Give public access to uploads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'uploads');
      `);
      console.log('Select policy created.');
    } catch (e: any) {
      console.log('Select policy likely already exists:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'uploads');
      `);
      console.log('Insert policy created.');
    } catch (e: any) {
      console.log('Insert policy likely already exists:', e.message);
    }
    
    // Some supabase instances need anon to be able to insert
    try {
      await prisma.$executeRawUnsafe(`GRANT ALL ON storage.objects TO anon;`);
      await prisma.$executeRawUnsafe(`GRANT ALL ON storage.buckets TO anon;`);
      await prisma.$executeRawUnsafe(`GRANT ALL ON storage.objects TO authenticated;`);
      await prisma.$executeRawUnsafe(`GRANT ALL ON storage.buckets TO authenticated;`);
      console.log('Grants applied.');
    } catch (e: any) {
      console.log('Grants failed:', e.message);
    }

  } catch (error) {
    console.error('Error setting up bucket:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
