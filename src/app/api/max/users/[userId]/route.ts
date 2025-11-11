/**
 * API endpoint для получения информации о пользователе MAX по ID
 * GET /api/max/users/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMaxApiClient } from '@/services/maxApiService';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Получаем токен из заголовка Authorization или query параметра
    const authHeader = request.headers.get('Authorization');
    const token = authHeader || request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'MAX API token is required' },
        { status: 401 }
      );
    }

    // Создаем клиент MAX API
    const maxApi = createMaxApiClient(token);

    // Получаем данные пользователя
    const user = await maxApi.getUser(userId);

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching MAX user:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch user data from MAX API',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

