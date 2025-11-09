import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tasks - получить все задачи
export async function GET(request: NextRequest) {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

    const { title, description, deadline, priority, assignee, tags } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const taskData = {
      title,
      description: description || '',
      deadline: deadline ? new Date(deadline).toISOString() : null,
      priority: priority || 'medium',
      assignee: assignee || 'Я',
      tags: tags || [],
      completed: false,
      order: 0,
    };

    console.log('💾 Inserting task to Supabase:', taskData);

    const { data: task, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Task created:', task);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

