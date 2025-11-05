export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-gray-800">
          Hello World! 👋
        </h1>
        <p className="text-xl text-gray-600">
          Добро пожаловать в мини-приложение для MAX
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-indigo-600 mb-2">
              Социальный трек
            </h2>
            <p className="text-gray-600">
              Хакатон VK 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

