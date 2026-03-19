import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { clockOut } from '@/lib/actions/attendance';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body for isFinalCheckout flag
    let isFinalCheckout = false;
    try {
      const body = await request.json();
      isFinalCheckout = body.isFinalCheckout === true;
    } catch {
      // No body or invalid JSON, assume break clock-out
    }
    
    const userId = parseInt(session.user.id);
    const result = await clockOut(userId, isFinalCheckout);
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Clock out error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
