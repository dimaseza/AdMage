import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const generations = await prisma.generation.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, generations });

  } catch (error) {
    console.error('Gallery Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
