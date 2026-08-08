# ARCHITECTURE.md — Архитектура и Логика Проекта (Events & Chat App)

Этот документ содержит полное описание архитектуры приложения, структуры базы данных, серверных функций (Edge Functions) и логики фронтенда. Используется как единый источник правды (Single Source of Truth) при разработке и внесении изменений.

---

## 1. Стек технологий
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3, Web Push API, Service Worker (`sw.js`).
* **Backend (BaaS):** Supabase (PostgreSQL, GoTrue Auth, Realtime Engine).
* **Serverless / Push:** Supabase Edge Functions (Deno / TypeScript), Web-Push (VAPID).

---

## 2. Структура Базы Данных (Supabase PostgreSQL)

### Таблица `events` (События / Встречи)
* `id` (uuid / bigint, primary key) — Уникальный идентификатор события.
* `title` (text) — Название встречи.
* `category` (text) — Категория (спорт, настолки, прогулки и т.д.).
* `event_date` (timestamptz) — Дата и время проведения.
* `description` (text) — Описание встречи.
* `creator_id` (uuid) — ID пользователя из `auth.users`, создавшего событие.
* `creator_name` (text) — Отображаемое имя создателя.
* `participants` (jsonb / text[]) — Массив имен (display_name) пользователей, записавшихся на событие. Создатель добавляется туда автоматически при создании.

### Таблица `event_messages` (Сообщения чата)
* `id` (uuid / bigint, primary key) — ID сообщения.
* `event_id` (uuid / bigint) — FK, указывает на `events.id`.
* `user_id` (uuid) — FK, ID автора сообщения из `auth.users`.
* `user_name` (text) — Имя автора сообщения.
* `user_email` (text) — Email автора сообщения.
* `text` (text) — Текст сообщения.
* `created_at` (timestamptz) — Время отправки.

### Таблица `user_push_subscriptions` (Подписки на Push-уведомления)
* `id` (uuid / bigint, primary key) — ID записи.
* `user_id` (uuid, unique) — ID пользователя из `auth.users`.
* `subscription_json` (jsonb) — Объект подписки браузера (`PushSubscription`).
* `updated_at` (timestamptz) — Дата последнего обновления ключа.

---

## 3. Серверная Логика: Database Webhooks & Edge Function (`send-push`)

### Database Webhooks (в панели Supabase)
1. **Webhook на таблицу `events`:**
   * **Event:** `INSERT`
   * **Target:** Edge Function `send-push`
2. **Webhook на таблицу `event_messages`:**
   * **Event:** `INSERT`
   * **Target:** Edge Function `send-push`

### Логика работы Edge Function (`send-push`)
* **При INSERT в `events`:**
  1. Берёт создателя `record.creator_id`.
  2. Запрашивает подписки из `user_push_subscriptions`, исключая создателя (`user_id != creator_id`).
  3. Рассылает Web Push с анонсом нового события всем зарегистрированным пользователям.
* **При INSERT в `event_messages`:**
  1. Берет `record.event_id` и запрашивает событие из таблицы `events`.
  2. Достает массив `participants` и `creator_id`.
  3. Сопоставляет имена участников с их `user_id` через `supabase.auth.admin.listUsers()`.
  4. Формирует список получателей (`recipientUserIds`), исключая самого автора сообщения (`record.user_id`).
  5. Находит подписки из `user_push_subscriptions` только для этих `recipientUserIds` и отправляет им Web Push.
  6. Если подписка устарела (ошибка 410/404), автоматически удаляет её из `user_push_subscriptions`.

---

## 4. Логика Фронтенда (`app.js`)

### Авторизация и Доступ
* Инициализация Supabase Client.
* Авторизация через email/пароль (`signUp` / `signInWithPassword`).
* В `user_metadata` сохраняется `display_name`.
* Проверка прав доступа к чату (`canUserAccessChat`): чат доступен **только** пользователям, чье имя есть в массиве `event.participants`, либо если пользователь — `creator_id`.

### Отображение событий (`renderEvents`)
* Загрузка списка событий из `events` с сортировкой по `event_date`.
* Отрисовка карточек с фильтрацией по категориям.
* Если пользователь **не участник**, кнопка «💬 Чат» скрывается/блокируется.

### Чат и Realtime (`openChat`, `subscribeToChatMessages`)
* Открытие чата проверяет `canUserAccessChat`.
* Загрузка сообщений из `event_messages` по `event_id`.
* Динамическое создание Realtime-канала с фильтрацией:
  `supabase.channel('chat-' + eventId).on('postgres_changes', { filter: 'event_id=eq.' + eventId }, ...)`
* При закрытии модалки чата Realtime-канал отписывается (`removeChannel`), чтобы не тратить ресурсы.

### Push-уведомления на клиенте
* Регистрация Service Worker (`sw.js`).
* При клике на «Включить уведомления» берется VAPID Public Key, формируется подписка и сохраняется в `user_push_subscriptions` под `currentUser.id`.
* Локальные пуши на фронтенде **не создаются**, чтобы не было дублирования с Edge Function.

---

## 5. Правила Доработки (Правила Валидации Новых Фич)
При добавлении новых функций строго соблюдать следующие ограничения:
1. **Не ломать связи:** Поле `participants` в `events` является ключевым источником прав для доступа к чату и таргетирования пушей.
2. **Не дублировать подписки:** Все новые Realtime-подписки должны содержать `filter` по конкретному ID или удаляться при закрытии модальных окон.
3. **Типизация и сравнение ID:** При сравнении UUID / ID всегда приводить их к строке (`String(id)`), чтобы избежать ошибок с типами в Edge Functions и JS.
4. **Безопасность Push:** Отправка уведомлений участникам чата происходит исключительно на сервере через Edge Function, фронтенд только отправляет сообщения в базу (`event_messages`).