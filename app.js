// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА SUPABASE
// ==========================================
// Адрес вашего проекта Supabase
const SUPABASE_URL = 'https://yynwjaeqohbsgkxjuukp.supabase.co';

// ⚠️ Переменная переименована в supabaseClient, чтобы не было конфликта с глобальным объектом supabase
const SUPABASE_KEY = 'sb_publishable_y08oAM3XLsMdlMkW7rsb2w_L5SOXMOb'; 

// Создаем подключение к базе данных под именем supabaseClient
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ
// ==========================================
let currentUser = null;       // Текущий пользователь (null если не вошел)
let currentCategory = 'all';  // Фильтр категории ('all', 'Спорт' и т.д.)
let showArchive = false;      // Показ архива (true/false)
let allEvents = [];           // Данные ивентов из базы данных
let isSignUp = false;         // Режим формы: false = Вход, true = Регистрация

// ==========================================
// 3. ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ СТРАНИЦЫ (DOM)
// ==========================================
const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authForm = document.getElementById('authForm');
const modalTitle = document.getElementById('modalTitle');
const nameGroup = document.getElementById('nameGroup');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthLink = document.getElementById('toggleAuthLink');
const toggleAuthText = document.getElementById('toggleAuthText');

const userProfile = document.getElementById('userProfile');
const userNameSpan = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

const createEventBtn = document.getElementById('createEventBtn');
const eventModal = document.getElementById('eventModal');
const closeEventModal = document.getElementById('closeEventModal');
const eventForm = document.getElementById('eventForm');

const eventsList = document.getElementById('eventsList');
const categoryFilters = document.getElementById('categoryFilters');
const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
const inviteBtn = document.getElementById('inviteBtn');
const toast = document.getElementById('toast');

// ==========================================
// 4. ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Навешиваем слушатели событий на кнопки СРАЗУ, чтобы интерфейс реагировал на клики
  setupEventListeners();

  // Загружаем данные о сессии пользователя и список встреч
  checkUser();
  loadEvents();
});

// ==========================================
// 5. РАБОТА С АВТОРИЗАЦИЕЙ И СЕССИЕЙ
// ==========================================

// Проверка: вошел ли пользователь в систему ранее
async function checkUser() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session) {
      currentUser = session.user;
      // Берём имя пользователя из метаданных или логин из email
      const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
      userNameSpan.textContent = name;
      
      // Отображаем элементы для авторизованного пользователя
      userProfile.classList.remove('hidden');
      authBtn.classList.add('hidden');
      createEventBtn.classList.remove('hidden');
    } else {
      currentUser = null;
      userProfile.classList.add('hidden');
      authBtn.classList.remove('hidden');
      createEventBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('Ошибка проверки пользователя:', err.message);
  }
}

// ==========================================
// 6. ЗАГРУЗКА И ФИЛЬТРАЦИЯ ИВЕНТОВ
// ==========================================

// Запрос списка встреч из таблицы 'events'
async function loadEvents() {
  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;

    allEvents = data || [];
    renderEvents(); // Вызываем отрисовку карточек
  } catch (err) {
    console.error('Ошибка при загрузке встреч:', err.message);
    eventsList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">
      Ошибка подключения к базе. Проверьте правильность anon key.
    </p>`;
  }
}

// Отрисовка карточек встреч в интерфейсе
function renderEvents() {
  eventsList.innerHTML = '';
  const now = new Date();

  // Отбор ивентов под текущие фильтры
  const filtered = allEvents.filter(event => {
    const eventDate = new Date(event.event_date);
    const isPast = eventDate < now;

    // 1. Фильтр по архиву/предстоящим
    if (showArchive) {
      if (!isPast) return false;
    } else {
      if (isPast) return false;
    }

    // 2. Фильтр по выбранной категории
    if (currentCategory !== 'all' && event.category !== currentCategory) {
      return false;
    }

    return true;
  });

  // Заглушка, если ничего не найдено
  if (filtered.length === 0) {
    eventsList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem;">
      ${showArchive ? 'Архив прошедших встреч пуст' : 'Нет предстоящих встреч в этой категории'}
    </p>`;
    return;
  }

  // Генерация HTML-кода для каждой карточки
  filtered.forEach(event => {
    const isCreator = currentUser && event.creator_id === currentUser.id;
    const participants = event.participants || [];
    const isJoined = currentUser && participants.includes(currentUser.id);

    const dateStr = new Date(event.event_date).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = `event-card ${showArchive ? 'archived' : ''}`;
    card.innerHTML = `
      <div class="event-header">
        <div>
          <h3 class="event-title">${escapeHtml(event.title)}</h3>
          <span class="event-creator">от ${escapeHtml(event.creator_name || 'Аноним')}</span>
        </div>
        <span class="event-category">${escapeHtml(event.category)}</span>
      </div>
      <div class="event-date">📅 ${dateStr}</div>
      <p class="event-description">${escapeHtml(event.description || '')}</p>
      
      <div class="event-footer">
        <span class="participants-count">👥 Участников: ${participants.length}</span>
        <div class="card-actions">
          ${!showArchive && currentUser ? `
            <button class="btn btn-sm ${isJoined ? 'btn-danger' : 'btn-primary'}" onclick="toggleParticipation('${event.id}')">
              ${isJoined ? 'Отменить участие' : 'Пойду'}
            </button>
          ` : ''}
          
          ${isCreator ? `
            <button class="btn btn-sm btn-outline" style="color: #ef4444; border-color: #ef4444;" onclick="deleteEvent('${event.id}')">Удалить</button>
          ` : ''}
        </div>
      </div>
    `;
    eventsList.appendChild(card);
  });
}

// ==========================================
// 7. ДЕЙСТВИЯ: ЗАПИСЬ, УДАЛЕНИЕ, СОЗДАНИЕ
// ==========================================

// Запись или отмена участия
window.toggleParticipation = async function(eventId) {
  if (!currentUser) return;

  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  let participants = event.participants || [];
  if (participants.includes(currentUser.id)) {
    participants = participants.filter(id => id !== currentUser.id);
  } else {
    participants.push(currentUser.id);
  }

  const { error } = await supabaseClient
    .from('events')
    .update({ participants })
    .eq('id', eventId);

  if (error) {
    alert('Ошибка при изменении участия: ' + error.message);
  } else {
    loadEvents();
  }
};

// Удаление встречи создателем
window.deleteEvent = async function(eventId) {
  if (!confirm('Вы точно хотите удалить эту встречу?')) return;

  const { error } = await supabaseClient
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    alert('Ошибка при удалении: ' + error.message);
  } else {
    loadEvents();
  }
};

// Отправка формы создания новой встречи
eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const creatorName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

  const newEvent = {
    title: document.getElementById('eventTitle').value,
    category: document.getElementById('eventCategory').value,
    event_date: document.getElementById('eventDate').value,
    description: document.getElementById('eventDescription').value,
    creator_id: currentUser.id,
    creator_name: creatorName,
    participants: [currentUser.id]
  };

  const { error } = await supabaseClient.from('events').insert([newEvent]);

  if (error) {
    alert('Ошибка создания ивента: ' + error.message);
  } else {
    eventModal.classList.add('hidden');
    eventForm.reset();
    loadEvents();
  }
});

// ==========================================
// 8. НАВЕШИВАНИЕ ОБРАБОТЧИКОВ СОБЫТИЙ (КЛИКИ)
// ==========================================
function setupEventListeners() {
  
  // Открытие модального окна входа
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      authModal.classList.remove('hidden');
    });
  }

  // Закрытие модального окна входа
  if (closeAuthModal) {
    closeAuthModal.addEventListener('click', () => {
      authModal.classList.add('hidden');
    });
  }

  // Открытие модального окна создания ивента
  if (createEventBtn) {
    createEventBtn.addEventListener('click', () => {
      eventModal.classList.remove('hidden');
    });
  }

  // Закрытие модального окна создания ивента
  if (closeEventModal) {
    closeEventModal.addEventListener('click', () => {
      eventModal.classList.add('hidden');
    });
  }

  // Клик по вкладкам категорий
  if (categoryFilters) {
    categoryFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderEvents();
      }
    });
  }

  // ПереключениеАрхив / Предстоящие
  if (toggleArchiveBtn) {
    toggleArchiveBtn.addEventListener('click', () => {
      showArchive = !showArchive;
      toggleArchiveBtn.textContent = showArchive ? '◀ Предстоящие' : '📁 Архив';
      renderEvents();
    });
  }

  // Кнопка копирования ссылки
  if (inviteBtn) {
    inviteBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      showToast();
    });
  }

  // Переключение между Входом и Регистрацией
  if (toggleAuthLink) {
    toggleAuthLink.addEventListener('click', (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      modalTitle.textContent = isSignUp ? 'Регистрация' : 'Вход в аккаунт';
      authSubmitBtn.textContent = isSignUp ? 'Зарегистрироваться' : 'Войти';
      nameGroup.classList.toggle('hidden', !isSignUp);
      toggleAuthText.textContent = isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
      toggleAuthLink.textContent = isSignUp ? 'Войти' : 'Зарегистрироваться';
    });
  }

  // Отправка формы авторизации / регистрации
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authEmail.value;
      const password = authPassword.value;

      if (isSignUp) {
        const name = authName.value;
        const { error } = await supabaseClient.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        });
        if (error) alert('Ошибка регистрации: ' + error.message);
        else { 
          alert('Успешная регистрация! Теперь войдите в аккаунт.'); 
          authModal.classList.add('hidden'); 
          checkUser(); 
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert('Ошибка входа: ' + error.message);
        else { 
          authModal.classList.add('hidden'); 
          await checkUser(); 
          await loadEvents(); 
        }
      }
    });
  }

  // Выход из профиля
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      await checkUser();
      await loadEvents();
    });
  }
}

// Показ всплывающего сообщения Toast
function showToast() {
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Защита от XSS-атак
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}