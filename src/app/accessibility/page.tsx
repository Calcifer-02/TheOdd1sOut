export default function AccessibilityPage() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-green-50 to-teal-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          Доступность
        </h1>

        <div className="grid gap-6">
          {/* Настройки размера текста */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-teal-600 mb-4">
              Размер текста
            </h2>
            <div className="flex gap-4">
              <button className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition">
                Маленький
              </button>
              <button className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition">
                Средний
              </button>
              <button className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition">
                Большой
              </button>
            </div>
          </div>

          {/* Контрастность */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-teal-600 mb-4">
              Контрастность
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">Высокая контрастность</span>
              <button className="px-6 py-2 bg-gray-300 rounded-full hover:bg-gray-400 transition">
                Вкл/Выкл
              </button>
            </div>
          </div>

          {/* Голосовое управление */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-teal-600 mb-4">
              🎤 Голосовое управление
            </h2>
            <p className="text-gray-600 mb-4">
              Управляйте приложением с помощью голосовых команд
            </p>
            <button className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
              Включить микрофон
            </button>
          </div>

          {/* Упрощенный режим */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-teal-600 mb-4">
              Упрощенный режим
            </h2>
            <p className="text-gray-600 mb-4">
              Более крупные элементы интерфейса и упрощенная навигация
            </p>
            <button className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
              Активировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

