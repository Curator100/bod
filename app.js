const SUPABASE_URL     = 'https://pszdtriimrmigadinhma.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzemR0cmlpbXJtaWdhZGluaG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDU3NzgsImV4cCI6MjA5MDYyMTc3OH0.URfO_-8I4GbmHZ1x3gVPJ2j1xnP_uwJrXS6-CJwa0Xk';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser   = null;
let currentTab    = 'login';
let currentFilter = 'all';
let allTasks      = [];

// ─── HELPERS ─────────────────────────────────────────────

// Wraps any promise with a timeout so nothing hangs forever
function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showTaskError(msg) {
  const list = document.getElementById('task-list');
  list.innerHTML = `<div class="empty-state error-state">⚠️ ${escapeHtml(msg)}</div>`;
}

// ─── AUTH ────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-btn-text').textContent = tab === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('auth-footer').innerHTML = tab === 'login'
    ? `Don't have an account? <a href="#" onclick="switchTab('signup')">Sign up free</a>`
    : `Already have an account? <a href="#" onclick="switchTab('login')">Sign in</a>`;
  hideMessages();
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

function showSuccess(msg) {
  const el = document.getElementById('auth-success');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('auth-error').classList.add('hidden');
}

function hideMessages() {
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

async function handleAuth() {
  const email   = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn     = document.getElementById('auth-btn');
  const btnText = document.getElementById('auth-btn-text');

  if (!email || !password) { showError('Please enter your email and password.'); return; }

  btn.disabled = true;
  btnText.textContent = '…';
  hideMessages();

  try {
    if (currentTab === 'login') {
      const { error } = await withTimeout(sb.auth.signInWithPassword({ email, password }));
      if (error) throw error;
    } else {
      const { error } = await withTimeout(sb.auth.signUp({ email, password }));
      if (error) throw error;
      showSuccess('Account created! Check your email to confirm, then sign in.');
      btn.disabled = false;
      btnText.textContent = 'Create Account';
      switchTab('login');
    }
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
    btn.disabled = false;
    btnText.textContent = currentTab === 'login' ? 'Sign In' : 'Create Account';
  }
}

async function logout() {
  // Don't wait forever — force logout after 3s no matter what
  try {
    await withTimeout(sb.auth.signOut(), 3000);
  } catch (_) {}
  currentUser = null;
  allTasks = [];
  showScreen('auth');
}

// ─── SCREENS ─────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

// ─── FILTER ──────────────────────────────────────────────

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  renderTasks(allTasks);
}

// ─── TASKS ───────────────────────────────────────────────

async function loadTasks() {
  const list = document.getElementById('task-list');
  list.innerHTML = '<div class="loading-tasks">loading…</div>';

  try {
    const { data, error } = await withTimeout(
      sb.from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('inserted_at', { ascending: true })
    );

    if (error) throw error;

    allTasks = data || [];
    renderTasks(allTasks);
    updateStats(allTasks);

  } catch (err) {
    console.error('loadTasks error:', err);
    // Show error with a retry button — never leave it stuck on "loading…"
    list.innerHTML = `
      <div class="empty-state error-state">
        ⚠️ Could not load tasks.<br>
        <small>${escapeHtml(err.message)}</small><br><br>
        <button class="btn-retry" onclick="loadTasks()">Try again</button>
      </div>
    `;
  }
}

function renderTasks(tasks) {
  let filtered = tasks;
  if (currentFilter === 'active') filtered = tasks.filter(t => !t.is_complete);
  if (currentFilter === 'done')   filtered = tasks.filter(t => t.is_complete);

  const list     = document.getElementById('task-list');
  const clearBar = document.getElementById('clear-bar');

  if (filtered.length === 0) {
    const msgs = {
      all:    'no tasks yet — add one above',
      active: 'nothing pending 🎉',
      done:   'nothing completed yet'
    };
    list.innerHTML = `<div class="empty-state">${msgs[currentFilter]}</div>`;
  } else {
    list.innerHTML = filtered.map(t => `
      <div class="task-item" id="task-${t.id}">
        <div class="task-check ${t.is_complete ? 'checked' : ''}" onclick="toggleTask('${t.id}', ${t.is_complete})"></div>
        <span class="task-text ${t.is_complete ? 'done' : ''}">${escapeHtml(t.task)}</span>
        <button class="task-delete" onclick="deleteTask('${t.id}')" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `).join('');
  }

  const hasDone = tasks.some(t => t.is_complete);
  clearBar.classList.toggle('hidden', !hasDone);
}

function updateStats(tasks) {
  const total = tasks.length;
  const done  = tasks.filter(t => t.is_complete).length;
  const left  = total - done;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent  = done;
  document.getElementById('stat-left').textContent  = left;
}

async function addTask() {
  const input = document.getElementById('new-task');
  const text  = input.value.trim();
  if (!text) return;

  // Optimistically clear input immediately
  input.value = '';

  try {
    const { error } = await withTimeout(
      sb.from('todos').insert({
        task:        text,
        user_id:     currentUser.id,
        is_complete: false
      })
    );

    if (error) throw error;
    await loadTasks();

  } catch (err) {
    console.error('addTask error:', err);
    // Put the text back so they don't lose it
    input.value = text;
    alert('Could not save task: ' + (err.message || 'Unknown error'));
  }
}

async function toggleTask(id, current) {
  try {
    const { error } = await withTimeout(
      sb.from('todos').update({ is_complete: !current }).eq('id', id)
    );
    if (error) throw error;
    await loadTasks();
  } catch (err) {
    console.error('toggleTask error:', err);
    alert('Could not update task: ' + err.message);
  }
}

async function deleteTask(id) {
  try {
    const { error } = await withTimeout(
      sb.from('todos').delete().eq('id', id)
    );
    if (error) throw error;
    await loadTasks();
  } catch (err) {
    console.error('deleteTask error:', err);
    alert('Could not delete task: ' + err.message);
  }
}

async function clearCompleted() {
  try {
    const { error } = await withTimeout(
      sb.from('todos')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('is_complete', true)
    );
    if (error) throw error;
    await loadTasks();
  } catch (err) {
    console.error('clearCompleted error:', err);
  }
}

// ─── SESSION ─────────────────────────────────────────────

sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    const emailEl  = document.getElementById('user-email-display');
    const avatarEl = document.getElementById('avatar-letter');
    if (emailEl)  emailEl.textContent  = currentUser.email;
    if (avatarEl) avatarEl.textContent = currentUser.email[0].toUpperCase();
    showScreen('app');
    await loadTasks();
  } else {
    currentUser = null;
    allTasks    = [];
    showScreen('auth');
  }
});
