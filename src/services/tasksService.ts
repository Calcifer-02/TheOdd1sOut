import { Task } from '@/types/task';

export class TasksService {
  private static baseUrl = '/api/tasks';

  // Получить user_id из MAX API или debug режима
  private static getUserId(): string | null {
    if (typeof window === 'undefined') return null;

    // Проверяем MAX API
    const maxApi = (window as any).MAX;
    console.log('🔍 [TasksService] Checking MAX API:', maxApi);

    if (maxApi?.user?.user_id) {
      console.log('✅ [TasksService] Found user_id from MAX:', maxApi.user.user_id);
      return maxApi.user.user_id.toString();
    }

    // Проверяем debug режим (localStorage)
    const debugUserId = localStorage.getItem('debug_user_id');
    if (debugUserId) {
      console.log('✅ [TasksService] Found user_id from localStorage:', debugUserId);
      return debugUserId;
    }

    console.warn('⚠️ [TasksService] No user_id found!');
    return null;
  }

  // Получить headers с user_id
  private static getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const userId = this.getUserId();
    if (userId) {
      headers['x-user-id'] = userId;
    }

    return headers;
  }

  // Получить все задачи
  static async fetchTasks(): Promise<Task[]> {
    const response = await fetch(this.baseUrl, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    return response.json();
  }

  // Создать новую задачу
  static async createTask(data: Omit<Task, 'id'>): Promise<Task> {
    const userId = this.getUserId();
    console.log('📝 [TasksService] Creating task with userId:', userId);

    const taskData = {
      ...data,
      ...(userId && { user_id: parseInt(userId) }),
    };

    console.log('📤 [TasksService] Sending task data:', taskData);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      throw new Error('Failed to create task');
    }

    const createdTask = await response.json();
    console.log('✅ [TasksService] Task created:', createdTask);
    return createdTask;
  }

  // Обновить задачу
  static async updateTask(id: number, data: Partial<Task>): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to update task');
    }
    return response.json();
  }

  // Переключить статус задачи
  static async toggleTask(id: number, completed: boolean): Promise<Task> {
    return this.updateTask(id, { completed });
  }

  // Удалить задачу
  static async deleteTask(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
  }

  // Переупорядочить задачи
  static async reorderTasks(tasks: Task[]): Promise<void> {
    const promises = tasks.map((task, index) =>
      this.updateTask(task.id, { order: index })
    );
    await Promise.all(promises);
  }
}

