import { Task } from '@/types/task';

export class TasksService {
  private static baseUrl = '/api/tasks';

  // Получить все задачи
  static async fetchTasks(): Promise<Task[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    return response.json();
  }

  // Создать новую задачу
  static async createTask(data: Omit<Task, 'id'>): Promise<Task> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    return response.json();
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

