import type { CapacitorConfig } from '@capacitor/cli'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Приложение показывает живой сайт smarket.kg внутри своей оболочки.
// Отдельный фронтенд для телефона не собираем: сайт серверный (output: standalone),
// каталог и заказы приходят из 1С и SBonus через его же API.
// ios-web/ — это не сайт, а страница-заглушка на случай, когда сети нет.
// Файл проекта Firebase от Google. Кладёт его владелец (scripts/setup-fcm.sh),
// в репозитории его может и не быть. Проверяем при каждом `cap sync`.
const hasFirebase = existsSync(join(__dirname, 'android', 'app', 'google-services.json'))

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
    // 'never', а не 'always'. Страница сама отводит место под часы и под овал
    // жеста «домой» (viewport-fit=cover и env(...) в CSS). Если то же самое
    // делает ещё и WebKit, отступы складываются дважды: сверху и снизу
    // вылезают полосы, а в тёмное время суток они ещё и чёрные — это фон
    // самого приложения, страница туда не дотягивается.
    contentInset: 'never',
    // Подложка под страницей. Белая, как сама страница: даже если WebKit на
    // мгновение покажет её при повороте или запуске, чёрной полосы не будет.
    backgroundColor: '#ffffff',
    // Приложение — не браузер: страница не должна приближаться сама.
    // Это и так по умолчанию, пишем явно, чтобы случайно не включилось.
    zoomEnabled: false,
  },
  android: {
    // Подложка под страницей — белая, как на iPhone.
    backgroundColor: '#ffffff',
    zoomEnabled: false,
    // Push на Android работает только через Firebase (FCM). Без файла
    // google-services.json плагин роняет приложение при подписке, поэтому
    // подключаем его, только если файл лежит в android/app/. Нет файла —
    // сборка ровно прежняя: плагина нет, сайт видит «уведомлений нет»
    // и кнопку не показывает. Файл появился — `cap sync` добавит плагин,
    // а build.gradle сам подключит Google-сервисы.
    includePlugins: hasFirebase ? ['@capacitor/push-notifications'] : [],
  },
  plugins: {
    // Android 15+ растягивает приложение под часы и под полоску жестов.
    // Сайт уже умеет отводить место сам (viewport-fit=cover и env(...) в CSS),
    // поэтому говорим это сразу — чтобы страница не прыгала при запуске.
    // LIGHT — тёмные значки часов и батареи на белом фоне сайта.
    SystemBars: {
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
    // Уведомление о заказе видно и со звуком, даже когда приложение открыто.
    // Android читает это при каждом уведомлении; iPhone — со следующей сборки.
    PushNotifications: {
      presentationOptions: ['alert', 'sound'],
    },
  },
}

export default config
