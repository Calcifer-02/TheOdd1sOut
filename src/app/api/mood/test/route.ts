import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('[API /mood/test] Request received');
    console.log('[API /mood/test] userId parameter:', userId);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required', example: '/api/mood/test?userId=123456' },
        { status: 400 }
      );
    }

    // Используем service role key для обхода RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log('[API /mood/test] Supabase URL:', supabaseUrl);
    console.log('[API /mood/test] Using service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Тест 1: Получаем ВСЕ записи (для диагностики)
    const { data: allData, error: allError, count: allCount } = await supabase
      .from('mood_test_results')
      .select('user_id', { count: 'exact' });

    console.log('[API /mood/test] Total records in table:', allCount);
    console.log('[API /mood/test] Unique users:', allData ? [...new Set(allData.map(d => d.user_id))] : []);

    // Тест 2: Получаем данные для конкретного user
    console.log('[API /mood/test] Fetching mood test results for user:', userId);
    const { data, error, count } = await supabase
      .from('mood_test_results')
      .select('*', { count: 'exact' })
      .eq('user_id', parseInt(userId))
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('[API /mood/test] Supabase error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
          hint: 'Check if table exists and RLS policies are set correctly',
          totalRecordsInTable: allCount,
          uniqueUsersInTable: allData ? [...new Set(allData.map(d => d.user_id))] : []
        },
        { status: 500 }
      );
    }

    console.log('[API /mood/test] Found', count, 'records for user', userId);

    return NextResponse.json({
      success: true,
      userId: parseInt(userId),
      totalRecords: count,
      data: data,
      message: `Successfully fetched ${count} mood test results`,
      debug: {
        totalRecordsInTable: allCount,
        uniqueUsersInTable: allData ? [...new Set(allData.map(d => d.user_id))] : [],
        usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });

  } catch (error) {
    console.error('[API /mood/test] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

