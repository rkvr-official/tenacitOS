import { NextResponse } from 'next/server';
import { scanAllSkills } from '@/lib/skill-parser';

export const revalidate = 300;

export async function GET() {
  try {
    const skills = scanAllSkills();
    
    return NextResponse.json({
      skills,
    });
  } catch (error) {
    console.error('Failed to scan skills:', error);
    return NextResponse.json({ skills: [] }, { status: 500 });
  }
}
