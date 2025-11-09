import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nefhoavveazzidfpobey.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.error('⚠️ SUPABASE_ANON_KEY не найден в .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для TypeScript (автоматически из БД)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      tasks: {
        Row: {
          id: number;
          title: string;
          description: string | null;
          completed: boolean;
          deadline: string | null;
          priority: 'low' | 'medium' | 'high';
          assignee: string;
          tags: string[];
          order: number;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      completed_tasks: {
        Row: {
          id: number;
          task_id: number | null;
          title: string;
          description: string | null;
          priority: 'low' | 'medium' | 'high';
          assignee: string;
          tags: string[];
          completed_at: string;
          original_created_at: string | null;
          original_deadline: string | null;
        };
        Insert: Omit<Database['public']['Tables']['completed_tasks']['Row'], 'id' | 'completed_at'>;
        Update: Partial<Database['public']['Tables']['completed_tasks']['Insert']>;
      };
      daily_stats: {
        Row: {
          id: number;
          date: string;
          tasks_completed: number;
          goal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daily_stats']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['daily_stats']['Insert']>;
      };
    };
  };
};


