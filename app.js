// ==========================================
// ИНИЦИАЛИЗАЦИЯ SUPABASE (БОЕВАЯ БАЗА)
// ==========================================

const SUPABASE_URL = 'https://yynwjaeqohbsgkxjuukp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y08oAM3XLsMdlMkW7rsb2w_L5SOXMOb';

let supabaseClient = null;

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] Подключено к базе данных');
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
let currentChatEventId = null;
let eventsChannel = null;
let chatRealtimeChannel = null;
let deferredPrompt = null; // Для установки PWA

const eventsList = document.getElementById('eventsList');
const categoryFilters = document.getElementById('categoryFilters');
const createEventBtn = document.getElementById('createEventBtn');
const inviteBtn = document.getElementById('inviteBtn');
const enablePushBtn = document.getElementById('enablePushBtn');
const installAppBtn = document.getElementById('installAppBtn');
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

// Модалка Чата
const chatModal = document.getElementById('chatModal');
const closeChatModal = document.getElementById('closeChatModal');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessagesContainer = document.getElementById('chatMessages');

// Модалка Калькулятора
const calcModal = document.getElementById('calcModal');
const closeCalcModal = document.getElementById('closeCalcModal');
const calcPayerSelect = document.getElementById('calcPayer');
const calcItemsContainer = document.getElementById('calcItemsContainer');
const addCalcItemBtn = document.getElementById('addCalcItemBtn');
const calculateBtn = document.getElementById('calculateBtn');
const calcResult = document.getElementById('calcResult');
const calcResultList = document.getElementById('calcResultList');
const sendCalcToChatBtn = document.getElementById('sendCalcToChatBtn');

let isSignUpMode = false;
let currentCalcParticipants = [];
let calcItemsCount = 0;
let lastCalculatedText = '';

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

// Преобразование UUID/идентификатора участника в отображаемое имя
function resolveParticipantName(p) {
  if (!p) return 'Участник';
  if (currentUser && (p === currentUser.id || p === currentUser.email)) {
    return getUserDisplayName(currentUser);
  }
  if (typeof p === 'string' && p.length === 36 && p.includes('-')) {
    return `Участник (${p.substring(0, 6)}...)`;
  }
  return String(p);
}

// ФОРМАТИРОВАНИЕ ДАТЫ И ВРЕМЕНИ
function formatDate(dateString) {
  if (!dateString) return 'Дата не указана';

  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return `${day} ${months[month - 1]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateString)) {
    const [datePart, timePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':');
    return `${day} ${months[month - 1]} в ${hours}:${minutes}`;
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

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

function canUserAccessChat(event) {
  if (!currentUser || !event) return false;
  const currentUserName = getUserDisplayName(currentUser);
  const rawParticipants = Array.isArray(event.participants) ? event.participants : [];
  
  const isAttending = rawParticipants.some(p => 
    p === currentUserName || p === currentUser.id || p === currentUser.email
  );
  const isCreator = event.creator_id === currentUser.id;
  
  return isAttending || isCreator;
}

// ==========================================
// PWA УСТАНОВКА И УПРАВЛЕНИЕ КНОПКОЙ
// ==========================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn) {
    installAppBtn.classList.remove('hidden');
  }
});

const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (installAppBtn) {
  if (isIos() && !isInStandaloneMode()) {
    installAppBtn.classList.remove('hidden');
  }

  installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Приложение успешно установлено!');
      }
      deferredPrompt = null;
      installAppBtn.classList.add('hidden');
    } else if (isIos()) {
      alert('Чтобы установить приложение на iPhone:\n\n' +
        '1. Если откроете в Telegram/In-App браузере: нажмите «···» вверху справа ➔ «Открыть в Safari».\n' +
        '2. В Safari нажмите кнопку «Поделиться» (квадрат со стрелкой внизу).\n' +
        '3. Выберите «На экран «Домой»».');
    }
  });
}

window.addEventListener('appinstalled', () => {
  if (installAppBtn) installAppBtn.classList.add('hidden');
  deferredPrompt = null;
  showToast('Приложение добавлено на главный экран!');
});

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
      if (currentUser && Notification.permission === 'granted') {
        subscribeUserToPush();
      }
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
    const rawParticipants = Array.isArray(event.participants) ? event.participants : [];
    
    // Проверяем участие по имени, id или email
    const isAttending = currentUser && rawParticipants.some(p => 
      p === currentUserName || p === currentUser.id || p === currentUser.email
    );
    const isCreator = currentUser && event.creator_id === currentUser.id;
    const canAccessChat = isAttending || isCreator;

    const maxParticipants = event.max_participants ? parseInt(event.max_participants, 10) : null;
    const isFull = maxParticipants ? rawParticipants.length >= maxParticipants : false;
    const countText = maxParticipants ? `${rawParticipants.length} / ${maxParticipants}` : `${rawParticipants.length}`;

    const formattedParticipantsHtml = rawParticipants.length > 0
      ? `<div style="margin-top: 0.8rem;">
           <span style="font-weight: 600;">👥 Идут (${countText}):</span>
           <ul style="margin: 0.4rem 0 0 1.2rem; padding: 0; list-style-type: disc; color: #e2e8f0;">
             ${rawParticipants.map(p => `<li style="margin-bottom: 0.2rem;">${escapeHtml(resolveParticipantName(p))}</li>`).join('')}
           </ul>
         </div>`
      : `<div style="margin-top: 0.8rem; color: #94a3b8;">👥 Пока никто не записался${maxParticipants ? ` (макс. ${maxParticipants})` : ''}</div>`;

    let attendanceBtnHtml = '';
    if (isAttending) {
      attendanceBtnHtml = `
        <button 
          class="btn btn-outline" 
          style="flex: 1;"
          onclick="toggleAttendance('${event.id}', ${JSON.stringify(rawParticipants).replace(/"/g, '&quot;')})"
        >
          Отменить участие
        </button>`;
    } else if (isFull) {
      attendanceBtnHtml = `
        <button 
          class="btn btn-secondary" 
          style="flex: 1; opacity: 0.7; cursor: not-allowed;" 
          disabled
        >
          Мест нет 🔒
        </button>`;
    } else {
      attendanceBtnHtml = `
        <button 
          class="btn btn-primary" 
          style="flex: 1;"
          onclick="toggleAttendance('${event.id}', ${JSON.stringify(rawParticipants).replace(/"/g, '&quot;')})"
        >
          Пойду
        </button>`;
    }

    return `
      <div class="event-card" style="background: #1e293b; padding: 1.25rem; border-radius: 0.75rem; border: 1px solid #334155; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.25rem;">${escapeHtml(event.title)}</h3>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="category-tag" style="background: #334155; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.85rem;">${escapeHtml(event.category)}</span>
            ${isCreator ? `<button onclick="deleteEvent('${event.id}')" style="background: #ef4444; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.8rem;" title="Удалить встречу">🗑</button>` : ''}
          </div>
        </div>
        
        <p style="color: #94a3b8; font-size: 0.875rem; margin: 0.25rem 0 0.75rem 0;">
          от ${escapeHtml(event.creator_name || 'Аноним')}
        </p>

        <p style="margin: 0.5rem 0;">📅 ${formatDate(event.event_date)}</p>
        
        ${event.description ? `<p style="margin: 0.5rem 0; color: #cbd5e1;">${escapeHtml(event.description)}</p>` : ''}

        ${formattedParticipantsHtml}

        <div style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${attendanceBtnHtml}
          
          ${canAccessChat ? `
            <button 
              class="btn btn-secondary open-chat-btn" 
              data-id="${event.id}"
              data-title="${escapeHtml(event.title)}"
            >
              💬 Чат
            </button>
            <button 
              class="btn btn-outline" 
              onclick="openCalculator('${event.id}')"
              title="Посчитать чек"
            >
              🧮 Сплит
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// ЛОГИКА УДАЛЕНИЯ И ЗАПИСИ
// ==========================================

window.deleteEvent = async function(eventId) {
  if (!confirm('Вы уверены, что хотите удалить эту встречу?')) return;

  try {
    await supabaseClient.from('event_messages').delete().eq('event_id', eventId);
    const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
    if (error) throw error;

    showToast('Встреча успешно удалена');
    await loadEvents();
  } catch (err) {
    alert('Не удалось удалить встречу: ' + err.message);
  }
};

window.toggleAttendance = async function(eventId, currentParticipants = []) {
  if (!currentUser) {
    if (authModal) authModal.classList.remove('hidden');
    return;
  }

  const participantName = getUserDisplayName(currentUser);
  let updatedParticipants = [...currentParticipants];

  const targetEvent = allEvents.find(e => String(e.id) === String(eventId));
  const maxParticipants = (targetEvent && targetEvent.max_participants !== null && targetEvent.max_participants !== undefined)
    ? Number(targetEvent.max_participants)
    : null;

  const isAlreadyAttending = updatedParticipants.some(p => 
    p === participantName || p === currentUser.id || p === currentUser.email
  );

  if (isAlreadyAttending) {
    updatedParticipants = updatedParticipants.filter(p => 
      p !== participantName && p !== currentUser.id && p !== currentUser.email
    );
  } else {
    if (maxParticipants !== null && !isNaN(maxParticipants) && updatedParticipants.length >= maxParticipants) {
      showToast('🔒 К сожалению, все места уже заняты!');
      return;
    }
    updatedParticipants.push(participantName);
  }

  try {
    const { error } = await supabaseClient
      .from('events')
      .update({ participants: updatedParticipants })
      .eq('id', eventId);

    if (error) {
      if (error.message && error.message.includes('check_max_participants')) {
        showToast('🔒 Все места уже заняты!');
        await loadEvents();
        return;
      }
      throw error;
    }
    
    if (currentChatEventId === eventId && !updatedParticipants.some(p => p === participantName || p === currentUser.id)) {
      closeChatModalWindow();
    }

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
    const maxParticipantsInput = document.getElementById('eventMaxParticipants');
    const maxParticipantsVal = maxParticipantsInput ? maxParticipantsInput.value.trim() : '';

    const newEvent = {
      title: document.getElementById('eventTitle').value,
      category: document.getElementById('eventCategory').value,
      event_date: document.getElementById('eventDate').value,
      description: document.getElementById('eventDescription').value,
      max_participants: maxParticipantsVal ? parseInt(maxParticipantsVal, 10) : null,
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
// ЛОГИКА ЧАТА (EVENT MESSAGES)
// ==========================================

async function markMessagesAsRead(messages) {
  if (!currentUser || !supabaseClient || !messages || messages.length === 0) return;

  const currentUserId = currentUser.id;

  const unreadMessages = messages.filter(msg => {
    if (msg.user_id === currentUserId) return false;
    const readList = Array.isArray(msg.read_by) ? msg.read_by : [];
    return !readList.includes(currentUserId);
  });

  if (unreadMessages.length === 0) return;

  for (const msg of unreadMessages) {
    const readList = Array.isArray(msg.read_by) ? msg.read_by : [];
    const updatedReadList = [...readList, currentUserId];

    await supabaseClient
      .from('event_messages')
      .update({ read_by: updatedReadList })
      .eq('id', msg.id);
  }
}

async function openChat(eventId, eventTitle) {
  const targetEvent = allEvents.find(e => String(e.id) === String(eventId));
  
  if (!canUserAccessChat(targetEvent)) {
    alert('Чат доступен только участникам события!');
    return;
  }

  currentChatEventId = eventId;
  
  const titleEl = document.getElementById('chatEventTitle');
  if (titleEl) titleEl.textContent = `Обсуждение: ${eventTitle}`;
  if (chatModal) chatModal.classList.remove('hidden');

  await loadChatMessages(eventId);
  subscribeToChatMessages(eventId);
}

async function loadChatMessages(eventId) {
  if (!chatMessagesContainer) return;

  try {
    const { data: messages, error } = await supabaseClient
      .from('event_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    renderMessages(messages);
    await markMessagesAsRead(messages);
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err.message);
    chatMessagesContainer.innerHTML = `<p style="color: #ef4444; text-align: center;">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

function renderMessages(messages) {
  if (!chatMessagesContainer) return;

  if (!messages || messages.length === 0) {
    chatMessagesContainer.innerHTML = '<p style="color: #94a3b8; text-align: center; margin-top: 2rem;">Пока нет сообщений. Напишите первым!</p>';
    return;
  }

  chatMessagesContainer.innerHTML = messages.map(msg => {
    const isMine = currentUser && msg.user_id === currentUser.id;
    
    let authorName = msg.user_name;
    if (!authorName && isMine) {
      authorName = getUserDisplayName(currentUser);
    }
    if (!authorName) {
      authorName = msg.user_email ? msg.user_email.split('@')[0] : 'Участник';
    }

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let statusHtml = '';
    if (isMine) {
      const readList = Array.isArray(msg.read_by) ? msg.read_by : [];
      const isReadByOthers = readList.some(id => id !== currentUser.id);

      statusHtml = isReadByOthers
        ? `<span style="color: #38bdf8; font-weight: bold; margin-left: 4px;" title="Прочитано">✓✓</span>`
        : `<span style="color: #94a3b8; margin-left: 4px;" title="Отправлено">✓</span>`;
    }

    return `
      <div class="chat-message ${isMine ? 'my-message' : ''}">
        <span class="chat-author">${escapeHtml(authorName)}</span>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
        <span class="chat-time">${time} ${statusHtml}</span>
      </div>
    `;
  }).join('');

  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!chatInput) return;

    const text = chatInput.value.trim();
    if (!text || !currentChatEventId) return;

    const targetEvent = allEvents.find(e => String(e.id) === String(currentChatEventId));
    if (!canUserAccessChat(targetEvent)) {
      alert('Вы не являетесь участником этого события.');
      return;
    }

    const displayName = getUserDisplayName(currentUser);

    try {
      const payload = {
        event_id: currentChatEventId,
        text: text,
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: displayName,
        read_by: [currentUser.id]
      };

      const { error } = await supabaseClient
        .from('event_messages')
        .insert([payload]);

      if (error) throw error;
      chatInput.value = '';
    } catch (err) {
      alert('Ошибка отправки сообщения: ' + err.message);
    }
  });
}

function closeChatModalWindow() {
  if (chatModal) chatModal.classList.add('hidden');
  currentChatEventId = null;
  if (chatRealtimeChannel) {
    supabaseClient.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = null;
  }
}

if (closeChatModal) {
  closeChatModal.addEventListener('click', closeChatModalWindow);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.open-chat-btn');
  if (btn) {
    const id = btn.dataset.id;
    const title = btn.dataset.title;
    if (id) {
      openChat(id, title);
    }
  }
});

// ==========================================
// ЛОГИКА КАЛЬКУЛЯТОРА РАЗДЕЛЕНИЯ СЧЕТА
// ==========================================

window.openCalculator = function(eventId) {
  const targetEvent = allEvents.find(e => String(e.id) === String(eventId));
  if (!targetEvent) return;

  const rawParticipants = Array.isArray(targetEvent.participants) ? targetEvent.participants : [];
  if (rawParticipants.length === 0) {
    alert('В этой встрече пока нет участников!');
    return;
  }

  // Преобразуем UUID в понятные имена для списка расчета
  currentCalcParticipants = rawParticipants.map(p => resolveParticipantName(p));
  currentChatEventId = eventId;

  refreshCalcParticipantsUI();

  if (calcItemsContainer) {
    calcItemsContainer.innerHTML = '';
    calcItemsCount = 0;
    addCalcItemRow();
  }

  if (calcResult) calcResult.style.display = 'none';
  if (sendCalcToChatBtn) sendCalcToChatBtn.classList.add('hidden');
  if (calcModal) calcModal.classList.remove('hidden');
};

function refreshCalcParticipantsUI() {
  if (calcPayerSelect) {
    calcPayerSelect.innerHTML = currentCalcParticipants.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  }
}

window.addExtraParticipant = function() {
  const guestName = prompt('Введите имя гостя (кто не был записан):');
  if (!guestName || !guestName.trim()) return;

  const trimmed = guestName.trim();
  if (currentCalcParticipants.includes(trimmed)) {
    alert('Участник с таким именем уже есть!');
    return;
  }

  currentCalcParticipants.push(trimmed);
  refreshCalcParticipantsUI();
  
  // Добавляем чекбокс нового участника во все действующие позиционные строки
  document.querySelectorAll('.calc-item-row .checkbox-group').forEach(group => {
    const label = document.createElement('label');
    label.style.cssText = 'font-size: 0.8rem; margin-right: 0.6rem; cursor: pointer; white-space: nowrap;';
    label.innerHTML = `<input type="checkbox" class="participant-checkbox" value="${escapeHtml(trimmed)}" checked> ${escapeHtml(trimmed)}`;
    group.appendChild(label);
  });
};

function addCalcItemRow() {
  calcItemsCount++;
  const row = document.createElement('div');
  row.className = 'calc-item-row';
  row.style.cssText = 'background: #1e293b; border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.75rem;';

  const checkboxesHtml = currentCalcParticipants.map(p => `
    <label style="font-size: 0.8rem; margin-right: 0.6rem; cursor: pointer; white-space: nowrap;">
      <input type="checkbox" class="participant-checkbox" value="${escapeHtml(p)}" checked> ${escapeHtml(p)}
    </label>
  `).join('');

  row.innerHTML = `
    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; align-items: center;">
      <input type="text" placeholder="Название (Кальян/Чай)" class="item-name" style="flex: 2 1 140px; min-width: 120px; padding: 0.4rem; font-size: 0.85rem; border-radius: 0.375rem; border: 1px solid #475569; background: #0f172a; color: white;">
      <input type="number" placeholder="Цена ₽" class="item-price" style="flex: 1 1 80px; min-width: 70px; padding: 0.4rem; font-size: 0.85rem; border-radius: 0.375rem; border: 1px solid #475569; background: #0f172a; color: white;">
      <input type="number" placeholder="Кол-во" value="1" min="1" class="item-qty" style="width: 60px; padding: 0.4rem; font-size: 0.85rem; border-radius: 0.375rem; border: 1px solid #475569; background: #0f172a; color: white;">
      <button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()" style="padding: 0.4rem 0.6rem; background: #ef4444; color: white; border: none; border-radius: 0.375rem; cursor: pointer;">✕</button>
    </div>
    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.3rem;">Кто позицию разделяет:</div>
    <div class="checkbox-group" style="display: flex; flex-wrap: wrap; gap: 0.4rem; max-height: 80px; overflow-y: auto;">
      ${checkboxesHtml}
    </div>
  `;

  if (calcItemsContainer) calcItemsContainer.appendChild(row);
}

if (addCalcItemBtn) {
  addCalcItemBtn.addEventListener('click', addCalcItemRow);
}

if (calculateBtn) {
  calculateBtn.addEventListener('click', () => {
    if (!calcPayerSelect || !calcItemsContainer) return;
    const payer = calcPayerSelect.value;
    const itemRows = calcItemsContainer.querySelectorAll('.calc-item-row');

    if (itemRows.length === 0) {
      alert('Добавьте хотя бы одну позицию!');
      return;
    }

    const totals = {};
    currentCalcParticipants.forEach(p => totals[p] = 0);
    let grandTotal = 0;

    for (let row of itemRows) {
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const qty = parseInt(row.querySelector('.item-qty').value, 10) || 1;
      const checked = Array.from(row.querySelectorAll('.participant-checkbox:checked')).map(cb => cb.value);

      if (price > 0 && checked.length > 0) {
        const itemTotal = price * qty;
        grandTotal += itemTotal;
        const share = itemTotal / checked.length;
        checked.forEach(p => {
          if (totals[p] !== undefined) totals[p] += share;
        });
      }
    }

    if (grandTotal === 0) {
      alert('Заполните цены и количества позиций!');
      return;
    }

    let resultHtml = `<div style="margin-bottom: 0.4rem;">💳 Общий чек: <b>${Math.round(grandTotal)} ₽</b></div>`;
    resultHtml += `<div style="margin-bottom: 0.4rem;">👤 Оплатил(а): <b>${escapeHtml(payer)}</b></div><hr style="border-color: var(--border-color); margin: 0.4rem 0;">`;
    
    let chatMessageText = `🧾 *Расчет по чеку (${Math.round(grandTotal)} ₽)*\nОплатил: ${payer}\n\n*Кто сколько должен:*`;

    Object.keys(totals).forEach(person => {
      const amount = Math.round(totals[person]);
      if (person !== payer) {
        resultHtml += `<div>• <b>${escapeHtml(person)}</b> ➔ ${escapeHtml(payer)}: <b>${amount} ₽</b></div>`;
        chatMessageText += `\n• ${person} ➔ ${payer}: ${amount} ₽`;
      } else {
        resultHtml += `<div style="color: var(--text-muted);">• ${escapeHtml(person)} (доля в чеке: ${amount} ₽)</div>`;
      }
    });

    if (calcResultList) calcResultList.innerHTML = resultHtml;
    if (calcResult) calcResult.style.display = 'block';

    lastCalculatedText = chatMessageText;
    if (sendCalcToChatBtn) sendCalcToChatBtn.classList.remove('hidden');
  });
}

if (sendCalcToChatBtn) {
  sendCalcToChatBtn.addEventListener('click', async () => {
    if (!lastCalculatedText || !currentChatEventId || !currentUser) return;

    try {
      const displayName = getUserDisplayName(currentUser);
      const payload = {
        event_id: currentChatEventId,
        text: lastCalculatedText,
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: displayName,
        read_by: [currentUser.id]
      };

      const { error } = await supabaseClient
        .from('event_messages')
        .insert([payload]);

      if (error) throw error;

      showToast('Расчет отправлен в чат встречи!');
      if (calcModal) calcModal.classList.add('hidden');
    } catch (err) {
      alert('Ошибка отправки в чат: ' + err.message);
    }
  });
}

if (closeCalcModal) {
  closeCalcModal.addEventListener('click', () => {
    if (calcModal) calcModal.classList.add('hidden');
  });
}

// ==========================================
// REALTIME СЛУШАТЕЛИ
// ==========================================

function subscribeToEvents() {
  if (!supabaseClient) return;

  if (eventsChannel) {
    supabaseClient.removeChannel(eventsChannel);
  }

  eventsChannel = supabaseClient
    .channel('events-changes-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      () => loadEvents()
    )
    .subscribe();
}

function subscribeToChatMessages(eventId) {
  if (!supabaseClient) return;

  if (chatRealtimeChannel) {
    supabaseClient.removeChannel(chatRealtimeChannel);
  }

  chatRealtimeChannel = supabaseClient
    .channel(`chat-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`
      },
      () => {
        if (currentChatEventId === eventId) {
          loadChatMessages(eventId);
        }
      }
    )
    .subscribe();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentChatEventId) {
    loadChatMessages(currentChatEventId);
  }
});

// ==========================================
// МОДАЛЬНЫЕ ОКНА И КНОПКИ
// ==========================================

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

if (inviteBtn) {
  inviteBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Ссылка скопирована в буфер обмена!');
  });
}

if (enablePushBtn) {
  enablePushBtn.addEventListener('click', () => {
    requestNotificationPermission();
  });
}

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
// PUSH-УВЕДОМЛЕНИЯ (SERVICE WORKER & VAPID)
// ==========================================

const PUBLIC_VAPID_KEY = 'BCfHpBIiAi9L6FdqJoBc5rueeMujPNsEJjtVDQ4hsRKkjsgJCCxfLmk5iBxltOIWfTJ85vCTsGqzf_hSedRO7iM';

if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker успешно зарегистрирован:', registration.scope);
    } catch (err) {
      console.error('Ошибка регистрации Service Worker:', err);
    }
  });
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Ваш браузер не поддерживает push-уведомления.');
    return;
  }

  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    showToast('Уведомления успешно включены!');
    await subscribeUserToPush();
  } else if (permission === 'denied') {
    alert('Вы запретили уведомления в настройках браузера.');
  }
}

async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    if (currentUser && supabaseClient) {
      const { error } = await supabaseClient
        .from('user_push_subscriptions')
        .upsert(
          [
            {
              user_id: currentUser.id,
              subscription_json: subscription.toJSON(),
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Ошибка сохранения подписки в Supabase:', error);
      } else {
        console.log('Пуш-подписка успешно сохранена в Supabase');
      }
    }
  } catch (err) {
    console.error('Ошибка подписки на Push:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (nameGroup) nameGroup.style.display = 'none';
  initAuth();
  loadEvents();
  subscribeToEvents();
});