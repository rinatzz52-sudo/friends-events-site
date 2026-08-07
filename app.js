// ==========================================
// ИНИЦИАЛИЗАЦИЯ SUPABASE
// ==========================================
// ВСТАВЬТЕ СВОИ ДАННЫЕ ИЗ SUPABASE ДАШБОРДА:
const SUPABASE_URL = 'https://yynwjaeqohbsgkxjuukp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y08oAM3XLsMdlMkW7rsb2w_L5SOXMOb';

let supabaseClient = null;

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Библиотека Supabase не загрузилась из CDN!');
  }
} catch (e) {
  console.error('Ошибка инициализации Supabase Client:', e);
}

// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ЭЛЕМЕНТЫ DOM
// ==========================================
let currentUser = null;
let allEvents = [];
let activeCategory = 'all';

// Получение элементов в строгом соответствии с index.html
const eventsList = document.getElementById('eventsList');
const categoryFilters = document.getElementById('categoryFilters');
const createEventBtn = document.getElementById('createEventBtn');
const inviteBtn = document.getElementById('inviteBtn');
const toast = document.getElementById('toast');

// Профиль и Авторизация
const userProfile = document.getElementById('userProfile');
const userNameEl = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const authBtn = document.getElementById('authBtn');

// Модалка Авторизации
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authForm = document.getElementById('authForm');
const modalTitle = document.getElementById('modalTitle');
const nameGroup = document.getElementById('nameGroup');
const authNameInput = document.getElementById('authName');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthLink = document.getElementById('toggleAuthLink');
const toggleAuthText = document.getElementById('toggleAuthText');

// Модалка Ивента
const eventModal = document.getElementById('eventModal');
const closeEventModal = document.getElementById('closeEventModal');
const eventForm = document.getElementById('eventForm');

let isSignUpMode = false; // Режим вход/регистрация

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getUserDisplayName(user) {
  if (!user) return 'Аноним';
  return (
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split('@')[0] : 'Участник')
  );
}

function formatDate(dateString) {
  if (!dateString) return 'Дата не указана';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} в ${hours}:${minutes}`;
}

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ==========================================
// АВТОРИЗАЦИЯ И ПРОФИЛЬ
// ==========================================

async function initAuth() {
  if (!supabaseClient) return;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateUserUI();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateUserUI();
      renderEvents();
    });
  } catch (err) {
    console.error('Ошибка проверки сессии:', err);
  }
}

function updateUserUI() {
  if (currentUser) {
    if (authBtn) authBtn.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (createEventBtn) createEventBtn.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = getUserDisplayName(currentUser);
  } else {
    if (authBtn) authBtn.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    if (createEventBtn) createEventBtn.classList.add('hidden');
  }
}

// Переключение Вход / Регистрация в модалке
if (toggleAuthLink) {
  toggleAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    
    if (isSignUpMode) {
      modalTitle.textContent = 'Регистрация';
      authSubmitBtn.textContent = 'Зарегистрироваться';
      toggleAuthText.textContent = 'Уже есть аккаунт?';
      toggleAuthLink.textContent = 'Войти';
      if (nameGroup) nameGroup.style.display = 'block';
    } else {
      modalTitle.textContent = 'Вход в аккаунт';
      authSubmitBtn.textContent = 'Войти';
      toggleAuthText.textContent = 'Нет аккаунта?';
      toggleAuthLink.textContent = 'Зарегистрироваться';
      if (nameGroup) nameGroup.style.display = 'none';
    }
  });
}

// Форма Входа / Регистрации
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();
    const name = authNameInput ? authNameInput.value.trim() : '';

    authSubmitBtn.disabled = true;

    try {
      if (isSignUpMode) {
        // Регистрация
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split('@')[0] }
          }
        });
        if (error) throw error;
        showToast('Успешная регистрация!');
      } else {
        // Вход
        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        showToast('Вы успешно вошли!');
      }

      if (authModal) authModal.classList.add('hidden');
      authForm.reset();
    } catch (err) {
      alert('Ошибка авторизации: ' + err.message);
    } finally {
      authSubmitBtn.disabled = false;
    }
  });
}

// Выход
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
      showToast('Вы вышли из системы');
    }
  });
}

// ==========================================
// ЗАГРУЗКА И ОТОБРАЖЕНИЕ СОБЫТИЙ
// ==========================================

async function loadEvents() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;

    allEvents = data || [];
    renderEvents();
  } catch (err) {
    console.error('Ошибка загрузки ивентов:', err.message);
    if (eventsList) {
      eventsList.innerHTML = `<p style="color: #ef4444; grid-column: 1/-1;">Не удалось загрузить встречи: ${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderEvents() {
  if (!eventsList) return;

  const filteredEvents = activeCategory === 'all'
    ? allEvents
    : allEvents.filter(e => e.category === activeCategory);

  if (filteredEvents.length === 0) {
    eventsList.innerHTML = `<p style="color: #94a3b8; grid-column: 1/-1;">Нет запланированных встреч в этой категории.</p>`;
    return;
  }

  const currentUserName = getUserDisplayName(currentUser);

  eventsList.innerHTML = filteredEvents.map(event => {
    const participants = Array.isArray(event.participants) ? event.participants : [];
    const isAttending = currentUser && participants.includes(currentUserName);

    // Список участников в столбик
    const formattedParticipantsHtml = participants.length > 0
      ? `<div style="margin-top: 0.8rem;">
           <span style="font-weight: 600;">👥 Идут (${participants.length}):</span>
           <ul style="margin: 0.4rem 0 0 1.2rem; padding: 0; list-style-type: disc; color: #e2e8f0;">
             ${participants.map(p => {
               const displayName = (p && p.length === 36 && p.includes('-')) ? 'Участник' : escapeHtml(p);
               return `<li style="margin-bottom: 0.2rem;">${displayName}</li>`;
             }).join('')}
           </ul>
         </div>`
      : `<div style="margin-top: 0.8rem; color: #94a3b8;">👥 Пока никто не записался</div>`;

    return `
      <div class="event-card" style="background: #1e293b; padding: 1.25rem; border-radius: 0.75rem; border: 1px solid #334155;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin: 0; font-size: 1.25rem;">${escapeHtml(event.title)}</h3>
          <span class="category-tag" style="background: #334155; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.85rem;">${escapeHtml(event.category)}</span>
        </div>
        
        <p style="color: #94a3b8; font-size: 0.875rem; margin: 0.25rem 0 0.75rem 0;">
          от ${escapeHtml(event.creator_name || 'Аноним')}
        </p>

        <p style="margin: 0.5rem 0;">📅 ${formatDate(event.event_date)}</p>
        
        ${event.description ? `<p style="margin: 0.5rem 0; color: #cbd5e1;">${escapeHtml(event.description)}</p>` : ''}

        ${formattedParticipantsHtml}

        <div style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem;">
          <button 
            class="btn ${isAttending ? 'btn-outline' : 'btn-primary'}" 
            style="width: 100%;"
            onclick="toggleAttendance('${event.id}', ${JSON.stringify(participants).replace(/"/g, '&quot;')})"
          >
            ${isAttending ? 'Отменить участие' : 'Пойду'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// ЛОГИКА ЗАПИСИ
// ==========================================
window.toggleAttendance = async function(eventId, currentParticipants = []) {
  if (!currentUser) {
    if (authModal) authModal.classList.remove('hidden');
    return;
  }

  const participantName = getUserDisplayName(currentUser);
  let updatedParticipants = [...currentParticipants];

  if (updatedParticipants.includes(participantName)) {
    updatedParticipants = updatedParticipants.filter(p => p !== participantName);
  } else {
    updatedParticipants.push(participantName);
  }

  try {
    const { error } = await supabaseClient
      .from('events')
      .update({ participants: updatedParticipants })
      .eq('id', eventId);

    if (error) throw error;
    await loadEvents();
  } catch (err) {
    alert('Не удалось обновить запись: ' + err.message);
  }
};

// ==========================================
// СОЗДАНИЕ ВСТРЕЧИ
// ==========================================
if (eventForm) {
  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !supabaseClient) return;

    const submitBtn = eventForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const creatorName = getUserDisplayName(currentUser);

    const newEvent = {
      title: document.getElementById('eventTitle').value,
      category: document.getElementById('eventCategory').value,
      event_date: document.getElementById('eventDate').value,
      description: document.getElementById('eventDescription').value,
      creator_id: currentUser.id,
      creator_name: creatorName,
      participants: [creatorName]
    };

    try {
      const { error } = await supabaseClient.from('events').insert([newEvent]);
      if (error) throw error;

      if (eventModal) eventModal.classList.add('hidden');
      eventForm.reset();
      await loadEvents();
      showToast('Встреча успешно создана!');
    } catch (err) {
      alert('Ошибка создания ивента: ' + err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ==========================================
// МОДАЛЬНЫЕ ОКНА И КНОПКИ
// ==========================================

// Открытие модалки авторизации
if (authBtn) {
  authBtn.addEventListener('click', () => {
    if (authModal) authModal.classList.remove('hidden');
  });
}

if (closeAuthModal) {
  closeAuthModal.addEventListener('click', () => {
    if (authModal) authModal.classList.add('hidden');
  });
}

// Открытие модалки создания встречи
if (createEventBtn) {
  createEventBtn.addEventListener('click', () => {
    if (!currentUser) {
      if (authModal) authModal.classList.remove('hidden');
      return;
    }
    if (eventModal) eventModal.classList.remove('hidden');
  });
}

if (closeEventModal) {
  closeEventModal.addEventListener('click', () => {
    if (eventModal) eventModal.classList.add('hidden');
  });
}

// Копирование ссылки
if (inviteBtn) {
  inviteBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Ссылка скопирована в буфер обмена!');
  });
}

// Фильтры категорий
if (categoryFilters) {
  const tabs = categoryFilters.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category || 'all';
      renderEvents();
    });
  });
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (nameGroup) nameGroup.style.display = 'none'; // По умолчанию режим "Вход"
  initAuth();
  loadEvents();
  subscribeToEvents();
});

// ==========================================
// ОБНОВЛЕНИЕ В РЕАЛЬНОМ ВРЕМЕНИ (REALTIME)
// ==========================================
let eventsChannel = null;

function subscribeToEvents() {
  if (!supabaseClient) return;

  // Отписываемся от старого канала, если он уже был создан
  if (eventsChannel) {
    supabaseClient.removeChannel(eventsChannel);
  }

  eventsChannel = supabaseClient
    .channel('events-changes-channel')
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'events' 
      },
      (payload) => {
        console.log('Realtime обновление получено:', payload);
        loadEvents(); // Перезагружаем список
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Успешно подключено к Realtime!');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('Ошибка Realtime канала:', err);
      }
      if (status === 'TIMED_OUT') {
        console.warn('Превышено время ожидания подключения к Realtime');
      }
    });
}