import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getAIConfig, updateAIConfig, testAIConnection, updateAITestStatus } from '@/lib/ai';

// GET /api/admin/ai-config - Get AI configuration
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const config = getAIConfig();
    
    // Don't expose the full API key, only show last 4 characters
    const maskedConfig = {
      ...config,
      api_key: config.api_key 
        ? `••••••••${config.api_key.slice(-4)}` 
        : null,
    };
    
    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error('AI config API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ai-config - Update AI configuration
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { api_key, model_name, is_enabled, test_connection } = body;
    
    // If testing connection
    if (test_connection && api_key && model_name) {
      const testResult = await testAIConnection(api_key, model_name);
      
      updateAITestStatus(
        testResult.success ? 'success' : 'failed',
        testResult.message
      );
      
      return NextResponse.json(testResult);
    }
    
    // Get current config to check if API key is being updated
    const currentConfig = getAIConfig();
    
    // If API key contains • character (masked) or is empty, it hasn't been changed
    const isMasked = api_key && (api_key.includes('•') || api_key.includes('...'));
    const finalApiKey = isMasked ? currentConfig.api_key : api_key;
    
    updateAIConfig({
      api_key: finalApiKey,
      model_name,
      is_enabled,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update AI config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
