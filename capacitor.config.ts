import type { CapacitorConfig } from '@capacitor/cli'

// Приложение показывает живой сайт smarket.kg внутри своей оболочки.
// Отдельный фронтенд для телефона не собираем: сайт серверный (output: standalone),
// каталог и заказы приходят из 1С и SBonus через его же API.
// ios-web/ — это не сайт, а страница-заглушка на случай, когда сети нет.
const config: CapacitorConfig = {
  appId: 'kg.smarket.app',
  appName: 'S Маркет',
  webDir: 'ios-web',
  server: {
    url: 'https://smarket.kg',
    // Сеть пропала или сервер не ответил — вместо ошибки WebKit показываем свою страницу.
    errorPath: 'index.html',
  },
  ios: {
    // Тянущийся «резиновый» скролл всей страницы выдаёт браузер внутри приложения.
    scrollEnabled: true,
    contentInset: 'always',
  },
}

export default config
