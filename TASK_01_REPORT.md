# TASK 01 REPORT — Smart Centr storefront prototype (milestone 01)

Дата: 11.09.2026 · Исполнитель: GLM (ZCode) · Ветка: `feature/milestone-01-02-storefront`

## Реализовано

- **Стек:** Next.js 16.3.4 (App Router, Turbopack, SSG), React 19, TypeScript strict.
  Минимум зависимостей: next/react/react-dom; dev — typescript, vitest (+ позже @playwright/test).
- **Страницы:** главная (hero, категории, популярные/новинки, SBonus/рассрочка-промо,
  ночной сценарий, инфо-блок), каталог с поиском/фильтрами/сортировкой, карточка товара
  с галереей и вариантами, корзина, избранное, демо-checkout, 404.
- **i18n:** RU/KY (`/[lang]/...` маршруты), полный словарь интерфейса включая ошибки
  и empty-states; кириллические Ң/Ө/Ү проверены; валюта сом/KGS.
- **Корзина:** localStorage-персистентность, варианты, лимит демо-остатка, пересчёт итога.
- **Дизайн-система:** палитра белый #FFFFFF / синий #245BEB / лайм #D9F86D /
  светло-голубой #F1F5FF / чернила #142334; кнопки ~50px, радиус ~16px,
  press-scale .98, `prefers-reduced-motion`, focus-visible, mobile bottom-nav,
  стекло только в навигации.
- **Честность:** весь контент помечен как демо; интеграции 1С/SBonus/банков нет;
  ночной текст «заявку примем, наличие/цену подтвердим утром, оплата после подтверждения».

## Проверки (на момент milestone 01)

- `npm run typecheck` — pass; `npm test` — 18 unit-тестов pass; `npm run build` — pass (43 статические страницы).
- Ручная проверка в браузере на 390px и desktop, RU/KY.

## Известные ограничения milestone 01

Демо-данные вместо склада 1С; SVG-схемы вместо реальных фото; checkout — локальная
демка; рассрочка/бонусы — помеченные заглушки; native-приложения не начинались.
Многие из этих пунктов доработаны в TASK 02 — см. [TASK_02_REPORT.md](TASK_02_REPORT.md).

## Preview

`http://localhost:3100` (команда: `npm run build && npm run start -- -p 3100`)
