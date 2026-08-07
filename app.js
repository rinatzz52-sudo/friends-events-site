// ==========================================
// ИНИЦИАЛИЗАЦИЯ SUPABASE
// ==========================================
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
let currentChatEventId = null;
let chatRealtimeChannel = null;
let eventsChannel = null;

const eventsList = document.getElementById('eventsList');
const categoryFilters = document.getElementById('categoryFilters');
const createEventBtn = document.getElementById('createEventBtn');
const inviteBtn = document.getElementById('inviteBtn');
const enablePushBtn = document.getElementById('enablePushBtn');
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

let isSignUpMode = false;

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
    const participants = Array.isArray(event.participants) ? event.participants : [];
    const isAttending = currentUser && participants.includes(currentUserName);

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

        <div style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem; display: flex; gap: 0.5rem;">
          <button 
            class="btn ${isAttending ? 'btn-outline' : 'btn-primary'}" 
            style="flex: 1;"
            onclick="toggleAttendance('${event.id}', ${JSON.stringify(participants).replace(/"/g, '&quot;')})"
          >
            ${isAttending ? 'Отменить участие' : 'Пойду'}
          </button>
          
          <button 
            class="btn btn-secondary open-chat-btn" 
            data-id="${event.id}"
            data-title="${escapeHtml(event.title)}"
          >
            💬 Чат
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
// ЛОГИКА ЧАТА (EVENT MESSAGES)
// ==========================================

async function openChat(eventId, eventTitle) {
  currentChatEventId = eventId;
  
  const titleEl = document.getElementById('chatEventTitle');
  if (titleEl) titleEl.textContent = `Обсуждение: ${eventTitle}`;
  if (chatModal) chatModal.classList.remove('hidden');

  await loadChatMessages(eventId);
  subscribeToChatMessages(eventId);
}

async function loadChatMessages(eventId) {
  if (!chatMessagesContainer) return;

  chatMessagesContainer.innerHTML = '<p style="color: #94a3b8; text-align: center; margin-top: 2rem;">Загрузка сообщений...</p>';

  try {
    const { data: messages, error } = await supabaseClient
      .from('event_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    renderMessages(messages);
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

    return `
      <div class="chat-message ${isMine ? 'my-message' : ''}">
        <span class="chat-author">${escapeHtml(authorName)}</span>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
        <span class="chat-time">${time}</span>
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

    if (!currentUser) {
      alert('Авторизуйтесь, чтобы отправлять сообщения');
      if (chatModal) chatModal.classList.add('hidden');
      if (authModal) authModal.classList.remove('hidden');
      return;
    }

    const displayName = getUserDisplayName(currentUser);

    try {
      const payload = {
        event_id: currentChatEventId,
        text: text,
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: displayName
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

if (closeChatModal) {
  closeChatModal.addEventListener('click', () => {
    if (chatModal) chatModal.classList.add('hidden');
    currentChatEventId = null;

    if (chatRealtimeChannel) {
      supabaseClient.removeChannel(chatRealtimeChannel);
      chatRealtimeChannel = null;
    }
  });
}

function subscribeToChatMessages(eventId) {
  if (chatRealtimeChannel) {
    supabaseClient.removeChannel(chatRealtimeChannel);
  }

  chatRealtimeChannel = supabaseClient
    .channel(`chat-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`
      },
      () => {
        loadChatMessages(eventId);
      }
    )
    .subscribe();
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
// REALTIME СОБЫТИЙ
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
      { 
        event: '*', 
        schema: 'public', 
        table: 'events' 
      },
      () => {
        loadEvents();
      }
    )
    .subscribe();
}

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
      // Исправленная отправка JSON-объекта подписки в Supabase
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