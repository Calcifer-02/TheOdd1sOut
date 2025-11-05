export default function AboutPage() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          О приложении
        </h1>
        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-indigo-600 mb-3">
              Социальное мини-приложение
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Разработано для хакатона VK - трек "Социальный".
              Наша миссия - сделать цифровые сервисы доступными для всех.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-indigo-600 mb-3">
              Технологии
            </h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Next.js 14 - React фреймворк</li>
              <li>TypeScript - типобезопасность</li>
              <li>Tailwind CSS - стилизация</li>
              <li>VK Bridge - интеграция с VK</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-indigo-600 mb-3">
              Команда
            </h2>
            <p className="text-gray-700">
              Студенты, участвующие в хакатоне VK 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

