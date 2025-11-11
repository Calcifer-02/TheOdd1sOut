import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tasks - получить все задачи
export async function GET(request: NextRequest) {
  try {
    // Получаем user_id из заголовков (если передан)
    const userId = request.headers.get('x-user-id');
    console.log('👤 Fetching tasks for user_id:', userId || 'all users');

    let query = supabase
      .from('tasks')
      .select('*');

    // Фильтруем по user_id если передан
    if (userId) {
      const parsedUserId = parseInt(userId);
      query = query.or(`user_id.eq.${parsedUserId},user_id.is.null`); // Получаем задачи пользователя + задачи без user_id (legacy)
    }

    const { data: tasks, error } = await query.order('order', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Found ${tasks?.length || 0} tasks`);
    return NextResponse.json(tasks || []);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - создать новую задачу
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 Received task data:', body);

    // Получаем user_id из заголовков (если передан)
    const userId = request.headers.get('x-user-id');
    console.log('👤 User ID from headers:', userId);

    const { title, description, deadline, priority, assignee, tags, user_id } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Используем user_id из body или из заголовков
    const finalUserId = user_id || (userId ? parseInt(userId) : null);
    console.log('🎯 Final user_id to save:', finalUserId);

    const taskData = {
      title,
      description: description || '',
      deadline: deadline ? new Date(deadline).toISOString() : null,
      priority: priority || 'medium',
      assignee: assignee || 'Я',
      tags: tags || [],
      completed: false,
      order: 0,
      ...(finalUserId && { user_id: finalUserId }), // Добавляем user_id если есть
    };

    console.log('💾 Inserting task to Supabase:', taskData);

    const { data: task, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Task created:', task);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

