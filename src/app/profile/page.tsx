export default function ProfilePage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          Профиль пользователя
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              П
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Пользователь VK</h2>
              <p className="text-gray-600">@username</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-2">Информация</h3>
              <p className="text-gray-600">Здесь будет информация о пользователе</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

