export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">
          Панель управления
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Карточка статистики */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Активность</h3>
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-3xl font-bold text-indigo-600">0</p>
            <p className="text-sm text-gray-500 mt-2">действий сегодня</p>
          </div>

          {/* Карточка пользователей */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Пользователи</h3>
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-3xl font-bold text-green-600">0</p>
            <p className="text-sm text-gray-500 mt-2">активных пользователей</p>
          </div>

          {/* Карточка достижений */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Достижения</h3>
              <span className="text-3xl">🏆</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">0</p>
            <p className="text-sm text-gray-500 mt-2">получено наград</p>
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Быстрые действия
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition">
              <span className="text-2xl block mb-2">➕</span>
              <span className="text-sm font-medium">Добавить</span>
            </button>
            <button className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition">
              <span className="text-2xl block mb-2">⚙️</span>
              <span className="text-sm font-medium">Настройки</span>
            </button>
            <button className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition">
              <span className="text-2xl block mb-2">📈</span>
              <span className="text-sm font-medium">Статистика</span>
            </button>
            <button className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition">
              <span className="text-2xl block mb-2">💬</span>
              <span className="text-sm font-medium">Сообщения</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

