// ИНИЦИАЛИЗАЦИЯ SUPABASE
const SUPABASE_URL = 'https://yynwjaeqohbsgkxjuukp.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_y08oAM3XLsMdlMkW7rsb2w_L5SOXMOb'; 

// Используем имя supabaseClient, чтобы не было конфликта с глобальным объектом supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ЭЛЕМЕНТЫ DOM
const authStatusEl = document.getElementById('auth-status');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authModalTitle = document.getElementById('auth-modal-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const usernameFieldGroup = document.getElementById('username-field-group');

const createEventModal = document.getElementById('create-event-modal');
const createEventForm = document.getElementById('create-event-form');
const openCreateModalBtn = document.getElementById('open-create-modal-btn');
const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
const eventsListEl = document.getElementById('events-list');

let currentUser = null;
let isSignUpMode = false;

// 1. ПРОВЕРКА СЕССИИ И АВТОРИЗАЦИИ
async function checkUserSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  renderAuthHeader();
  loadEvents();
}

function renderAuthHeader() {
  if (currentUser) {
    const username = currentUser.user_metadata?.username || currentUser.email;
    authStatusEl.innerHTML = `
      <span class="text-slate-300">👋 ${username}</span>
      <button id="logout-btn" class="bg-slate-700 hover:bg-slate-600 text-sm py-1.5 px-3 rounded-lg transition">
        Выйти
      </button>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  } else {
    authStatusEl.innerHTML = `
      <button id="open-auth-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-1.5 px-3 rounded-lg transition text-sm">
        Войти / Регистрация
      </button>
    `;
    document.getElementById('open-auth-btn')?.addEventListener('click', openAuthModal);
  }
}

// 2. МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
function openAuthModal() {
  authModal?.classList.remove('hidden');
}

function closeAuthModal() {
  authModal?.classList.add('hidden');
}

authToggleBtn?.addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  if (isSignUpMode) {
    authModalTitle.textContent = 'Регистрация';
    authSubmitBtn.textContent = 'Зарегистрироваться';
    authToggleText.textContent = 'Уже есть аккаунт?';
    authToggleBtn.textContent = 'Войти';
    usernameFieldGroup.classList.remove('hidden');
  } else {
    authModalTitle.textContent = 'Вход в аккаунт';
    authSubmitBtn.textContent = 'Войти';
    authToggleText.textContent = 'Нет аккаунта?';
    authToggleBtn.textContent = 'Зарегистрироваться';
    usernameFieldGroup.classList.add('hidden');
  }
});

authForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value;

  if (isSignUpMode) {
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) alert('Ошибка регистрации: ' + error.message);
    else {
      alert('Регистрация успешна!');
      closeAuthModal();
      checkUserSession();
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert('Ошибка входа: ' + error.message);
    else {
      closeAuthModal();
      checkUserSession();
    }
  }
});

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  checkUserSession();
}

// 3. УПРАВЛЕНИЕ ИВЕНТАМИ
openCreateModalBtn?.addEventListener('click', () => {
  if (!currentUser) {
    alert('Сначала войдите в аккаунт!');
    openAuthModal();
    return;
  }
  createEventModal?.classList.remove('hidden');
});

closeCreateModalBtn?.addEventListener('click', () => {
  createEventModal?.classList.add('hidden');
});

createEventForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('event-title').value;
  const category = document.getElementById('event-category').value;
  const event_date = document.getElementById('event-date').value;
  const description = document.getElementById('event-description').value;

  const { error } = await supabaseClient.from('events').insert([
    {
      title,
      category,
      event_date,
      description,
      creator_id: currentUser.id,
      participants: [currentUser.id]
    }
  ]);

  if (error) {
    alert('Ошибка при создании встречи: ' + error.message);
  } else {
    createEventModal?.classList.add('hidden');
    createEventForm.reset();
    loadEvents();
  }
});

// 4. ЗАГРУЗКА И ОТОБРАЖЕНИЕ ИВЕНТОВ
async function loadEvents() {
  const { data: events, error } = await supabaseClient
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки:', error);
    eventsListEl.innerHTML = `<p class="text-red-400 col-span-2">Ошибка загрузки встреч</p>`;
    return;
  }

  if (!events || events.length === 0) {
    eventsListEl.innerHTML = `<p class="text-slate-400 col-span-2">Пока нет созданных встреч. Будьте первым!</p>`;
    return;
  }

  eventsListEl.innerHTML = events.map(event => {
    const date = new Date(event.event_date).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const isParticipating = currentUser && event.participants?.includes(currentUser.id);
    const count = event.participants ? event.participants.length : 0;

    return `
      <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-bold text-white">${event.title}</h3>
            <span class="text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600">
              ${event.category}
            </span>
          </div>
          <p class="text-emerald-400 text-sm font-medium mb-3">📅 ${date}</p>
          <p class="text-slate-300 text-sm mb-4">${event.description || 'Без описания'}</p>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-slate-700/50 mt-2">
          <span class="text-xs text-slate-400">👥 Участников: ${count}</span>
          <button 
            onclick="toggleParticipation('${event.id}', ${isParticipating})" 
            class="text-sm px-3 py-1.5 rounded-lg font-medium transition ${
              isParticipating 
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }"
          >
            ${isParticipating ? 'Отменить участие' : 'Пойду'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 5. УЧАСТИЕ В ИВЕНТЕ
window.toggleParticipation = async (eventId, isParticipating) => {
  if (!currentUser) {
    alert('Сначала войдите в аккаунт!');
    openAuthModal();
    return;
  }

  const { data: event } = await supabaseClient.from('events').select('participants').eq('id', eventId).single();
  let participants = event?.participants || [];

  if (isParticipating) {
    participants = participants.filter(id => id !== currentUser.id);
  } else {
    if (!participants.includes(currentUser.id)) {
      participants.push(currentUser.id);
    }
  }

  await supabaseClient.from('events').update({ participants }).eq('id', eventId);
  loadEvents();
};

// Закрытие модалок по клику на фон
authModal?.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuthModal();
});
createEventModal?.addEventListener('click', (e) => {
  if (e.target === createEventModal) createEventModal.classList.add('hidden');
});

// Запуск при старте
checkUserSession();