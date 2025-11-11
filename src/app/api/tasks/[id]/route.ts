import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tasks/[id] - получить одну задачу
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - обновить задачу
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);
    console.log('📝 PATCH /api/tasks/' + taskId);

    const body = await request.json();
    console.log('Body:', body);

    const { title, description, completed, deadline, priority, assignee, tags, order } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (completed !== undefined) updateData.completed = completed;
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline).toISOString() : null;
    if (priority !== undefined) updateData.priority = priority;
    if (assignee !== undefined) updateData.assignee = assignee;
    if (tags !== undefined) updateData.tags = tags;
    if (order !== undefined) updateData.order = order;

    console.log('Update data:', updateData);

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!task) {
      console.error('❌ Task not found after update:', taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    console.log('✅ Task updated:', taskId);
    return NextResponse.json(task);
  } catch (error) {
    console.error('❌ Error updating task:', error);
    return NextResponse.json({
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - удалить задачу (и сохранить в completed_tasks)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);

    // Сначала получаем задачу
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      console.error('Task not found:', fetchError);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Если задача выполнена, сохраняем в completed_tasks
    if (task.completed) {
      console.log('📦 Saving completed task to archive with user_id:', task.user_id);

      const completedTaskData = {
        task_id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignee: task.assignee,
        tags: task.tags,
        original_created_at: task.created_at,
        original_deadline: task.deadline,
        user_id: task.user_id, // Добавляем user_id
      };

      console.log('💾 Inserting to completed_tasks:', completedTaskData);

      const { error: insertError } = await supabase
        .from('completed_tasks')
        .insert(completedTaskData);

      if (insertError) {
        console.error('❌ Failed to save to completed_tasks:', insertError);
        // Не останавливаем удаление, даже если не удалось сохранить в архив
      } else {
        console.log('✅ Task saved to completed_tasks with user_id:', task.user_id);

        // Обновляем daily_stats с user_id
        const today = new Date().toISOString().split('T')[0];
        const userId = task.user_id;

        console.log('📊 Updating daily_stats for user_id:', userId, 'date:', today);

        // Проверяем, есть ли запись за сегодня для этого пользователя
        let query = supabase
          .from('daily_stats')
          .select('*')
          .eq('date', today);

        // Фильтруем по user_id если он есть
        if (userId) {
          query = query.eq('user_id', userId);
        } else {
          query = query.is('user_id', null);
        }

        const { data: stats, error: statFetchError } = await query;

        console.log('📈 Existing daily_stats:', stats, 'error:', statFetchError);

        // Проверяем, нашли ли запись
        if (stats && stats.length > 0) {
          // Обновляем существующую запись
          const stat = stats[0];
          const updateResult = await supabase
            .from('daily_stats')
            .update({ tasks_completed: stat.tasks_completed + 1 })
            .eq('id', stat.id);
          console.log('✅ Daily stats updated for user:', userId, 'date:', today, 'new count:', stat.tasks_completed + 1);
        } else {
          // Создаем новую запись с user_id
          const insertData = {
            date: today,
            tasks_completed: 1,
            goal: 5,
            user_id: userId // Всегда добавляем user_id (может быть null)
          };
          console.log('➕ Creating new daily_stats:', insertData);
          const insertResult = await supabase
            .from('daily_stats')
            .insert(insertData);

          if (insertResult.error) {
            console.error('❌ Failed to create daily_stats:', insertResult.error);
          } else {
            console.log('✅ Daily stats created for user:', userId, 'date:', today);
          }
        }
      }
    }

    // Удаляем задачу из основной таблицы
    console.log('🗑️ Deleting task from tasks table, id:', taskId);
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      console.error('❌ Supabase delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('✅ Task deleted from tasks:', taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

