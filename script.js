
// ════════════════════════════════════════════════════════════
// SUPABASE CONFIG — sourced from supabase.js (SITS namespace)
// ════════════════════════════════════════════════════════════
var SITS = window.SITS || {};
var _cfg = SITS.getConfig ? SITS.getConfig() : {};
var SUPABASE_URL = _cfg.supabaseUrl || 'https://yffmpfdzrbwhuacvrhth.supabase.co';
var SUPABASE_ANON_KEY = _cfg.supabaseAnonKey || 'sb_publishable_eeqbo_Q3delLSZvfXkIKiw_85mzu_Am';
var ATTACHMENTS_BUCKET = _cfg.attachmentsBucket || 'entry-attachments';
var STALE_ENTRY_DAYS = _cfg.staleEntryDays || 7;
var STALE_REVIEW_DAYS = _cfg.staleReviewDays || 5;

const sb = SITS.getSb ? SITS.getSb() : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;   // { id, name, email, role, admission }
let activeTab   = '';
let reviewingEntryId = null;
let evaluatingPlacement = null; // { placement_id, student_id, studentName }
let selectedRole = 'student';
let pendingAttachmentFiles = [];

// ── TOAST ──────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type) {
  type = type || 'info';
  const el  = document.getElementById('toast');
  const ico = document.getElementById('toast-icon');
  const txt = document.getElementById('toast-msg');
  ico.textContent = type === 'success' ? '✓' : type === 'warn' ? '⚠' : 'ℹ';
  txt.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 3000);
}

function goToScreen(name) {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-register').classList.remove('active');
  document.getElementById('screen-' + name).classList.add('active');
  setTickerVisible(true);
}

function setTickerVisible(visible) {
  const t = document.querySelector('.ticker-wrap');
  if (t) t.style.display = visible ? 'flex' : 'none';
}

// ── light / dark theme ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const knob = document.getElementById('theme-toggle-knob');
  if (knob) knob.textContent = theme === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('sits-theme', theme); } catch (e) {}
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('sits-theme'); } catch (e) {}
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
})();

function selectRole(btn) {
  document.querySelectorAll('.role-btn').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  selectedRole = btn.dataset.role;
  document.getElementById('reg-admission-wrap').style.display = selectedRole === 'student' ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════
// AUTH — real Supabase Auth calls
// ════════════════════════════════════════════════════════════
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.querySelector('#screen-login .btn-primary');

  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in...';

  const { data, error } = await sb.auth.signInWithPassword({ email: email, password: pass });

  btn.disabled = false;
  btn.textContent = 'Sign in';

  if (error) {
    errEl.textContent = error.message === 'Invalid login credentials'
      ? 'Incorrect email or password.'
      : error.message;
    errEl.style.display = 'block';
    return;
  }

  await loadProfileAndEnter(data.user.id);
}

async function handleRegister() {
  const name      = document.getElementById('reg-name').value.trim();
  const admission = document.getElementById('reg-admission').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-password').value;
  const errEl     = document.getElementById('register-error');
  const okEl      = document.getElementById('register-success');
  const btn       = document.querySelector('#screen-register .btn-primary');

  if (!name || !email || !pass) {
    errEl.textContent = 'Please fill in your name, email, and password.';
    errEl.style.display = 'block'; okEl.style.display = 'none'; return;
  }
  if (pass.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.style.display = 'block'; okEl.style.display = 'none'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Creating account...';

  const { data, error } = await sb.auth.signUp({
    email: email,
    password: pass,
    options: {
      data: {
        full_name: name,
        role: selectedRole,
        admission_number: admission || null,
      }
    }
  });

  btn.disabled = false;
  btn.textContent = 'Create account';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  if (data.session) {
    okEl.textContent = 'Account created — signing you in...';
    okEl.style.display = 'block';
    setTimeout(function() { loadProfileAndEnter(data.user.id); }, 600);
  } else {
    okEl.textContent = 'Account created! Check your email to confirm, then sign in.';
    okEl.style.display = 'block';
  }
}

async function loadProfileAndEnter(userId) {
  const { data: profile, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    toast('Could not load your profile. Please try again.', 'warn');
    console.error(error);
    return;
  }

  currentUser = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
    admission: profile.admission_number,
    avatar: (profile.full_name || 'U U').split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0,2),
  };

  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-register').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  setTickerVisible(false);
  document.getElementById('user-avatar').textContent = currentUser.avatar;
  document.getElementById('user-name').textContent   = currentUser.name;

  const badge = document.getElementById('user-role-badge');
  const roleLabel = currentUser.role === 'admin' ? 'Admin / Coordinator'
    : (currentUser.role === 'university_supervisor' || currentUser.role === 'industry_supervisor') ? 'Supervisor'
    : 'Student';
  badge.textContent = roleLabel;
  badge.className = 'user-role-badge ' + (
    currentUser.role === 'admin' ? 'badge-admin'
    : (currentUser.role === 'university_supervisor' || currentUser.role === 'industry_supervisor') ? 'badge-supervisor'
    : 'badge-student'
  );

  await buildDashboard(currentUser.role);
  toast('Welcome, ' + currentUser.name.split(' ')[0] + '.', 'success');
}

async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('screen-app').classList.remove('active');
  goToScreen('login');
  toast('Signed out.');
  document.getElementById('theme-toggle-btn') && (document.getElementById('theme-toggle-btn').style.display = '');
}

(async function checkExistingSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    await loadProfileAndEnter(session.user.id);
  }
})();

// ════════════════════════════════════════════════════════════
// DASHBOARD ROUTING
// ════════════════════════════════════════════════════════════
async function buildDashboard(role) {
  if (role === 'student') await buildStudentDash();
  else if (role === 'university_supervisor' || role === 'industry_supervisor') await buildSupervisorDash();
  else if (role === 'admin') await buildAdminDash();
}

function buildNav(items) {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = items.map(function(item) {
    return '<button class="nav-item ' + (item.active ? 'active' : '') + '" onclick="switchTab(\'' + item.tab + '\')">' +
      '<span class="nav-icon">' + item.icon + '</span>' +
      item.label +
      (item.badge ? '<span class="nav-badge" id="badge-' + item.tab + '">' + item.badge + '</span>' : '') +
      '</button>';
  }).join('');
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('onclick') === "switchTab('" + tab + "')");
  });
  document.querySelectorAll('.content-section').forEach(function(s) { s.classList.remove('active'); });
  const sec = document.getElementById('section-' + tab);
  if (sec) { sec.classList.add('active'); renderSection(tab); }
}

function renderSection(tab) {
  if (tab === 'logbook')  renderLogbook();
  if (tab === 'feedback') renderFeedback();
  if (tab === 'overview' && currentUser && currentUser.role === 'student') renderStudentOverview();
  if (tab === 'pending')  renderPendingEntries();
  if (tab === 'reviewed') renderReviewedEntries();
  if (tab === 'students-list') renderStudentsList();
  if (tab === 'sv-overview')   renderSvOverview();
  if (tab === 'admin-overview') renderAdminOverview();
  if (tab === 'placements') renderPlacements();
  if (tab === 'all-students') renderAllStudents();
  if (tab === 'all-entries') renderAllEntries();
  if (tab === 'my-evaluations') renderMyEvaluations();
  if (tab === 'sv-evaluations') renderSvEvaluations();
}

// ════════════════════════════════════════════════════════════
// "ALIVE" HELPERS — count-up numbers, animated progress, ripple, insight ticker
// ════════════════════════════════════════════════════════════
function animateCount(el, target, opts) {
  if (!el) return;
  opts = opts || {};
  const duration = opts.duration || 900;
  const suffix = opts.suffix || '';
  const startTime = performance.now();
  function frame(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = Math.round(target * eased);
    el.textContent = value + suffix;
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(frame);
}

function animateAllStats(root) {
  (root || document).querySelectorAll('.stat-value[data-count]').forEach(function(el) {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    const suffix = el.getAttribute('data-suffix') || '';
    animateCount(el, target, { suffix: suffix });
  });
}

function animateProgressBars(root) {
  (root || document).querySelectorAll('.progress-fill[data-target]').forEach(function(el) {
    const target = el.getAttribute('data-target');
    el.style.width = '0%';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { el.style.width = target + '%'; });
    });
  });
}

// small ripple wherever the user actually taps/clicks — cards, buttons, nav items
document.addEventListener('click', function(e) {
  const target = e.target.closest('.btn, .btn-dark, .btn-primary, .btn-ghost, .nav-item, .stat-card');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
  target.appendChild(ripple);
  setTimeout(function() { ripple.remove(); }, 600);
});

function insightTickerHTML(items) {
  const doubled = items.concat(items);
  return '<div class="insight-ticker"><div class="insight-track">' +
    doubled.map(function(t) { return '<span>' + t + '</span>'; }).join('') +
    '</div></div>';
}

// ════════════════════════════════════════════════════════════
// FILE ATTACHMENTS (Supabase Storage)
// ════════════════════════════════════════════════════════════
function handleAttachmentPick(input) {
  pendingAttachmentFiles = Array.from(input.files || []);
  const preview = document.getElementById('entry-attachments-preview');
  preview.innerHTML = pendingAttachmentFiles.map(function(f) {
    return '<span class="attachment-chip">📎 ' + f.name + '</span>';
  }).join('');
}

async function uploadAttachments(entryId) {
  if (!pendingAttachmentFiles.length) return;
  for (const file of pendingAttachmentFiles) {
    const path = currentUser.id + '/' + entryId + '/' + Date.now() + '-' + file.name;
    const { error: upErr } = await sb.storage.from(ATTACHMENTS_BUCKET).upload(path, file);
    if (upErr) { console.error(upErr); toast('One attachment failed to upload: ' + upErr.message, 'warn'); continue; }
    const { data: pub } = sb.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
    await sb.from('entry_attachments').insert({
      entry_id: entryId,
      file_url: pub.publicUrl,
      file_name: file.name,
      file_type: file.type,
    });
  }
  pendingAttachmentFiles = [];
}

function attachmentsHTML(attachments) {
  if (!attachments || !attachments.length) return '';
  return '<div style="margin-top:10px;">' + attachments.map(function(a) {
    const isImage = a.file_type && a.file_type.indexOf('image') === 0;
    return '<a class="attachment-chip" href="' + a.file_url + '" target="_blank" rel="noopener noreferrer">' +
      (isImage ? '<img src="' + a.file_url + '"/>' : '📄') + ' ' + a.file_name +
      '</a>';
  }).join('') + '</div>';
}

// ════════════════════════════════════════════════════════════
// STUDENT DASHBOARD
// ════════════════════════════════════════════════════════════
let myEntriesCache = [];
let myPlacementCache = null;
let myEvaluationsCache = [];

async function fetchMyEntries() {
  const { data, error } = await sb
    .from('logbook_entries')
    .select('*, feedback(*), entry_attachments(*)')
    .eq('student_id', currentUser.id)
    .order('entry_date', { ascending: false });
  if (error) { console.error(error); toast('Could not load your entries.', 'warn'); return []; }
  return (data || []).map(function(e) {
    const fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
    return {
      id: e.id, title: e.title, type: e.entry_type, date: e.entry_date,
      activities: e.activities, learning: e.learning_points, challenges: e.challenges,
      status: e.status,
      feedback: fb ? fb.comments : null,
      score: fb ? fb.score : null,
      reviewer: null,
      attachments: e.entry_attachments || [],
    };
  });
}

async function fetchMyPlacement() {
  const { data, error } = await sb
    .from('placements')
    .select('*, university_supervisor:university_supervisor_id(full_name), industry_supervisor:industry_supervisor_id(full_name)')
    .eq('student_id', currentUser.id)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

async function fetchMyEvaluations() {
  if (!myPlacementCache) return [];
  const { data, error } = await sb
    .from('evaluations')
    .select('*')
    .eq('placement_id', myPlacementCache.id)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function buildStudentDash() {
  buildNav([
    { tab:'overview',  icon:'📋', label:'Overview', active:true },
    { tab:'logbook',   icon:'📝', label:'My Logbook' },
    { tab:'feedback',  icon:'💬', label:'Feedback' },
    { tab:'my-evaluations', icon:'🏆', label:'Evaluations' },
    { tab:'profile',   icon:'👤', label:'My Profile' },
  ]);

  document.getElementById('main-content').innerHTML =
    '<div class="page-header"><div class="page-title">Loading...</div></div>';

  myEntriesCache = await fetchMyEntries();
  myPlacementCache = await fetchMyPlacement();
  myEvaluationsCache = await fetchMyEvaluations();

  const verified  = myEntriesCache.filter(function(e) { return e.status === 'verified'; }).length;
  const pending   = myEntriesCache.filter(function(e) { return e.status === 'pending'; }).length;
  const revision  = myEntriesCache.filter(function(e) { return e.status === 'revision'; }).length;
  const progress  = Math.min(Math.round((verified / 10) * 100), 100);
  const flag = computeStudentFlag(myEntriesCache, myPlacementCache);

  const placementHTML = myPlacementCache ?
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
      '<div><div class="label">Organisation</div><div style="font-size:13.5px;font-weight:600;">' + (myPlacementCache.organisation_name || '—') + '</div></div>' +
      '<div><div class="label">Supervisor</div><div style="font-size:13.5px;font-weight:600;">' + (myPlacementCache.university_supervisor ? myPlacementCache.university_supervisor.full_name : '—') + '</div></div>' +
      '<div><div class="label">Start date</div><div style="font-size:13.5px;font-weight:600;">' + (myPlacementCache.start_date || '—') + '</div></div>' +
      '<div><div class="label">End date</div><div style="font-size:13.5px;font-weight:600;">' + (myPlacementCache.end_date || '—') + '</div></div>' +
    '</div>'
    : '<p class="text-muted" style="color:var(--slate-400);font-size:12.5px;">No placement assigned yet. Contact your coordinator.</p>';

  const tickerItems = [
    verified > 0 ? ('🔥 <b>' + verified + '</b> ' + (verified === 1 ? 'entry' : 'entries') + ' verified so far') : '🎯 Submit your first entry to get started',
    '📈 <b>' + progress + '%</b> of your attachment logged',
    pending > 0 ? ('🕐 <b>' + pending + '</b> awaiting supervisor review') : '✅ Nothing waiting on review right now',
    revision > 0 ? ('✍️ <b>' + revision + '</b> ' + (revision === 1 ? 'entry needs' : 'entries need') + ' a revision') : '🔒 Your records are row-level secured',
  ];

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Good morning, ' + currentUser.name.split(' ')[0] + '</div>' +
        '<div class="page-subtitle">Here\'s your attachment progress at a glance.</div>' +
      '</div>' +
      '<button class="btn btn-dark" onclick="openModal(\'modal-entry\')">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        'New entry' +
      '</button>' +
    '</div>' +
    insightTickerHTML(tickerItems) +
    '<div class="stat-row">' +
      '<div class="stat-card"><div class="stat-label">Total entries</div><div class="stat-value" data-count="' + myEntriesCache.length + '">0</div></div>' +
      '<div class="stat-card accent-emerald"><div class="stat-label">Verified</div><div class="stat-value" data-count="' + verified + '">0</div></div>' +
      '<div class="stat-card accent-amber"><div class="stat-label">Pending</div><div class="stat-value" data-count="' + pending + '">0</div></div>' +
      '<div class="stat-card accent-rose"><div class="stat-label">Needs revision</div><div class="stat-value" data-count="' + revision + '">0</div></div>' +
    '</div>' +
    '<div class="content-section active" id="section-overview">' +
      (flag ? '<div class="flag-banner flag-amber"><span class="flag-icon">🚩</span><span class="flag-text">' + flag + '</span></div>' : '') +
      '<div class="card" style="margin-bottom:16px;">' +
        '<div class="card-body">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="font-size:12.5px;font-weight:600;color:var(--slate-700);">Attachment progress</span>' +
            '<span style="font-size:12.5px;font-weight:700;color:var(--emerald);">' + progress + '%</span>' +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" data-target="' + progress + '" style="width:0%"></div></div>' +
          '<p style="font-size:11px;color:var(--slate-400);margin-top:6px;">' + verified + ' of 10 weekly entries verified</p>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<span class="card-title">Placement details</span>' +
          '<button class="btn btn-ghost btn-sm" onclick="exportStudentReport()">⬇ Export report (PDF)</button>' +
        '</div>' +
        '<div class="card-body">' + placementHTML + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px;">' +
        '<div class="card-header">' +
          '<span class="card-title">Recent entries</span>' +
          '<button class="btn btn-ghost btn-sm" onclick="switchTab(\'logbook\')">View all</button>' +
        '</div>' +
        '<div class="card-body" id="overview-recent"></div>' +
      '</div>' +
    '</div>' +
    '<div class="content-section" id="section-logbook">' +
      '<div class="toolbar">' +
        '<div class="search-wrap" style="flex:1;max-width:320px;">' +
          '<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input class="input" id="search-logbook" placeholder="Search entries..." oninput="renderLogbook()" style="padding-left:34px;"/>' +
        '</div>' +
        '<select class="input" id="filter-status" onchange="renderLogbook()" style="max-width:160px;">' +
          '<option value="">All entries</option>' +
          '<option value="verified">Verified</option>' +
          '<option value="pending">Pending review</option>' +
          '<option value="revision">Needs revision</option>' +
        '</select>' +
        '<button class="btn btn-dark btn-sm" onclick="openModal(\'modal-entry\')">+ New entry</button>' +
      '</div>' +
      '<div id="logbook-list"></div>' +
    '</div>' +
    '<div class="content-section" id="section-feedback"><div id="feedback-list"></div></div>' +
    '<div class="content-section" id="section-my-evaluations"><div id="my-evaluations-list"></div></div>' +
    '<div class="content-section" id="section-profile">' +
      '<div class="card" style="max-width:520px;">' +
        '<div class="card-header"><span class="card-title">My profile</span></div>' +
        '<div class="card-body">' +
          '<div class="field-row">' +
            '<div class="field"><label class="label">Full name</label><input class="input" id="profile-name-input" value="' + currentUser.name + '"/></div>' +
            '<div class="field"><label class="label">Admission no.</label><input class="input" id="profile-admission-input" value="' + (currentUser.admission || '') + '"/></div>' +
          '</div>' +
          '<div class="field"><label class="label">Email</label><input class="input" type="email" value="' + currentUser.email + '" disabled style="opacity:.6;"/></div>' +
          '<div class="field"><label class="label">Course</label><input class="input" id="profile-course-input" placeholder="Diploma in Software Engineering"/></div>' +
          '<div class="field" style="margin-bottom:0;"><label class="label">Phone</label><input class="input" id="profile-phone-input" placeholder="+254..."/></div>' +
          '<div style="margin-top:16px;"><button class="btn btn-dark" onclick="saveProfile()">Save changes</button></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  animateAllStats();
  animateProgressBars();
  renderStudentOverview();
  activeTab = 'overview';
}

function computeStudentFlag(entries, placement) {
  if (!placement || !placement.start_date) return null;
  const msDay = 86400000;
  const today = new Date();
  const dates = entries.map(function(e) { return new Date(e.date); }).sort(function(a,b){ return b - a; });
  const lastEntry = dates.length ? dates[0] : new Date(placement.start_date);
  const daysSince = Math.floor((today - lastEntry) / msDay);
  if (daysSince >= STALE_ENTRY_DAYS) {
    return 'No logbook entry in the last ' + daysSince + ' days. Log an entry to stay on track.';
  }
  return null;
}

async function saveProfile() {
  const full_name = document.getElementById('profile-name-input').value.trim();
  const admission_number = document.getElementById('profile-admission-input').value.trim();
  const course = document.getElementById('profile-course-input').value.trim();
  const phone = document.getElementById('profile-phone-input').value.trim();

  const { error } = await sb.from('profiles').update({
    full_name: full_name,
    admission_number: admission_number || null,
    course: course || null,
    phone: phone || null,
  }).eq('id', currentUser.id);

  if (error) { toast('Could not save profile.', 'warn'); console.error(error); return; }
  currentUser.name = full_name;
  document.getElementById('user-name').textContent = full_name;
  toast('Profile saved.', 'success');
}

function renderStudentOverview() {
  const el = document.getElementById('overview-recent');
  if (!el) return;
  const recent = myEntriesCache.slice(0,3);
  el.innerHTML = recent.length ? recent.map(function(e) { return entryCardHTML(e, false); }).join('')
    : '<div class="empty-state"><div class="empty-icon">📝</div><p>No entries yet.</p><button class="btn btn-dark btn-sm" onclick="openModal(\'modal-entry\')">Add your first entry</button></div>';
}

function renderLogbook() {
  const el = document.getElementById('logbook-list');
  if (!el) return;
  const search  = (document.getElementById('search-logbook') ? document.getElementById('search-logbook').value : '').toLowerCase();
  const filter  = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
  const entries = myEntriesCache.filter(function(e) {
    return (e.title.toLowerCase().indexOf(search) !== -1 || e.activities.toLowerCase().indexOf(search) !== -1) &&
      (filter ? e.status === filter : true);
  });
  el.innerHTML = entries.length ? entries.map(function(e) { return entryCardHTML(e, false); }).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><p>No entries match your search.</p></div>';
}

function renderFeedback() {
  const el = document.getElementById('feedback-list');
  if (!el) return;
  const withFeedback = myEntriesCache.filter(function(e) { return e.feedback; });
  el.innerHTML = withFeedback.length ? withFeedback.map(function(e) { return entryCardHTML(e, false); }).join('')
    : '<div class="empty-state"><div class="empty-icon">💬</div><p>No feedback received yet.</p></div>';
}

function renderMyEvaluations() {
  const el = document.getElementById('my-evaluations-list');
  if (!el) return;
  el.innerHTML = myEvaluationsCache.length ? myEvaluationsCache.map(evaluationCardHTML).join('')
    : '<div class="empty-state"><div class="empty-icon">🏆</div><p>No evaluations submitted by your supervisor yet.</p></div>';
}

// ════════════════════════════════════════════════════════════
// SUPERVISOR DASHBOARD
// ════════════════════════════════════════════════════════════
let supervisorEntriesCache = [];
let supervisorStudentsCache = [];
let supervisorEvaluationsCache = [];

async function fetchSupervisorEntries() {
  const { data: placements, error: plErr } = await sb
    .from('placements')
    .select('id, student_id, organisation_name, start_date, profiles:student_id(full_name, admission_number)')
    .or('university_supervisor_id.eq.' + currentUser.id + ',industry_supervisor_id.eq.' + currentUser.id);

  if (plErr) { console.error(plErr); return { entries: [], students: [] }; }

  const studentIds = (placements || []).map(function(p) { return p.student_id; });
  if (!studentIds.length) return { entries: [], students: [] };

  const { data: entries, error: enErr } = await sb
    .from('logbook_entries')
    .select('*, feedback(*), entry_attachments(*), profiles:student_id(full_name, admission_number)')
    .in('student_id', studentIds)
    .order('entry_date', { ascending: false });

  if (enErr) { console.error(enErr); return { entries: [], students: placements }; }

  const mapped = (entries || []).map(function(e) {
    const fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
    return {
      id: e.id, title: e.title, type: e.entry_type, date: e.entry_date,
      activities: e.activities, learning: e.learning_points, challenges: e.challenges,
      status: e.status,
      feedback: fb ? fb.comments : null,
      score: fb ? fb.score : null,
      reviewer: fb ? currentUser.name : null,
      studentName: e.profiles ? e.profiles.full_name : 'Unknown student',
      studentId: e.student_id,
      attachments: e.entry_attachments || [],
      created_at: e.created_at,
    };
  });

  return { entries: mapped, students: placements };
}

async function fetchSupervisorEvaluations() {
  const placementIds = supervisorStudentsCache.map(function(p) { return p.id; });
  if (!placementIds.length) return [];
  const { data, error } = await sb
    .from('evaluations')
    .select('*')
    .in('placement_id', placementIds)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function buildSupervisorDash() {
  document.getElementById('main-content').innerHTML = '<div class="page-header"><div class="page-title">Loading...</div></div>';

  const result = await fetchSupervisorEntries();
  supervisorEntriesCache = result.entries;
  supervisorStudentsCache = result.students;
  supervisorEvaluationsCache = await fetchSupervisorEvaluations();

  const pending = supervisorEntriesCache.filter(function(e) { return e.status === 'pending'; }).length;
  const reviewedCount = supervisorEntriesCache.filter(function(e) { return e.status === 'verified' || e.status === 'revision'; }).length;
  const flags = computeSupervisorFlags(supervisorEntriesCache, supervisorStudentsCache);

  buildNav([
    { tab:'sv-overview',   icon:'📋', label:'Overview', active:true },
    { tab:'pending',       icon:'⏳', label:'Pending Review', badge: pending > 0 ? pending : null },
    { tab:'reviewed',      icon:'✅', label:'Reviewed' },
    { tab:'students-list', icon:'👥', label:'My Students' },
    { tab:'sv-evaluations', icon:'🏆', label:'Evaluations', badge: flags.length > 0 ? flags.length : null },
  ]);

  const tickerItems = [
    pending > 0 ? ('⏳ <b>' + pending + '</b> ' + (pending === 1 ? 'entry' : 'entries') + ' waiting on you') : '✅ You are fully caught up',
    '👥 <b>' + supervisorStudentsCache.length + '</b> ' + (supervisorStudentsCache.length === 1 ? 'student' : 'students') + ' assigned to you',
    '📝 <b>' + reviewedCount + '</b> entries reviewed so far',
    '💬 Feedback reaches students the same day it\'s written',
  ];

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Supervisor dashboard</div>' +
        '<div class="page-subtitle">Review and verify student attachment logbook entries.</div>' +
      '</div>' +
    '</div>' +
    insightTickerHTML(tickerItems) +
    '<div class="stat-row">' +
      '<div class="stat-card"><div class="stat-label">Assigned students</div><div class="stat-value" data-count="' + supervisorStudentsCache.length + '">0</div></div>' +
      '<div class="stat-card accent-amber"><div class="stat-label">Pending review</div><div class="stat-value" data-count="' + pending + '" id="sv-stat-pending">0</div></div>' +
      '<div class="stat-card accent-emerald"><div class="stat-label">Total reviewed</div><div class="stat-value" data-count="' + reviewedCount + '">0</div></div>' +
      '<div class="stat-card accent-rose"><div class="stat-label">Flagged students</div><div class="stat-value" data-count="' + flags.length + '">0</div></div>' +
    '</div>' +
    '<div class="content-section active" id="section-sv-overview">' +
      '<div id="sv-flags"></div>' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Entries awaiting your review</span></div>' +
        '<div class="card-body" id="sv-overview-pending"></div>' +
      '</div>' +
    '</div>' +
    '<div class="content-section" id="section-pending"><div id="pending-list"></div></div>' +
    '<div class="content-section" id="section-reviewed"><div id="reviewed-list"></div></div>' +
    '<div class="content-section" id="section-students-list"><div id="students-cards"></div></div>' +
    '<div class="content-section" id="section-sv-evaluations"><div id="sv-evaluations-list"></div></div>';

  animateAllStats();
  renderSvOverview();
  activeTab = 'sv-overview';
}

function entryWithStudentLabel(e) {
  return e.studentName ? ('<div style="font-size:10.5px;color:var(--slate-500);font-weight:600;margin-bottom:4px;">' + e.studentName + '</div>') : '';
}

function computeSupervisorFlags(entries, students) {
  const msDay = 86400000;
  const today = new Date();
  const flags = [];

  students.forEach(function(p) {
    const student = p.profiles || {};
    const name = student.full_name || 'Unknown student';
    const studentEntries = entries.filter(function(e) { return e.studentId === p.student_id; });
    const dates = studentEntries.map(function(e) { return new Date(e.date); }).sort(function(a,b){ return b - a; });
    const lastEntry = dates.length ? dates[0] : (p.start_date ? new Date(p.start_date) : null);
    if (lastEntry) {
      const daysSince = Math.floor((today - lastEntry) / msDay);
      if (daysSince >= STALE_ENTRY_DAYS) {
        flags.push(name + ' has not logged an entry in ' + daysSince + ' days.');
      }
    }
  });

  entries.filter(function(e) { return e.status === 'pending'; }).forEach(function(e) {
    const created = e.created_at ? new Date(e.created_at) : new Date(e.date);
    const daysSince = Math.floor((today - created) / msDay);
    if (daysSince >= STALE_REVIEW_DAYS) {
      flags.push('"' + e.title + '" (' + e.studentName + ') has been pending review for ' + daysSince + ' days.');
    }
  });

  return flags;
}

function renderFlagsInto(elId, flags) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = flags.length ? flags.map(function(f) {
    return '<div class="flag-banner"><span class="flag-icon">🚩</span><span class="flag-text">' + f + '</span></div>';
  }).join('') : '';
}

function renderSvOverview() {
  const flags = computeSupervisorFlags(supervisorEntriesCache, supervisorStudentsCache);
  renderFlagsInto('sv-flags', flags);
  const el = document.getElementById('sv-overview-pending');
  if (!el) return;
  const pending = supervisorEntriesCache.filter(function(e) { return e.status === 'pending'; });
  el.innerHTML = pending.length ? pending.map(function(e) { return entryWithStudentLabel(e) + entryCardHTML(e, true); }).join('')
    : '<div class="empty-state"><div class="empty-icon">✅</div><p>All entries reviewed. Nicely done.</p></div>';
}

function renderPendingEntries() {
  const el = document.getElementById('pending-list');
  if (!el) return;
  const entries = supervisorEntriesCache.filter(function(e) { return e.status === 'pending'; });
  el.innerHTML = entries.length ? entries.map(function(e) { return entryWithStudentLabel(e) + entryCardHTML(e, true); }).join('')
    : '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending entries.</p></div>';
}

function renderReviewedEntries() {
  const el = document.getElementById('reviewed-list');
  if (!el) return;
  const entries = supervisorEntriesCache.filter(function(e) { return e.status === 'verified' || e.status === 'revision'; });
  el.innerHTML = entries.length ? entries.map(function(e) { return entryWithStudentLabel(e) + entryCardHTML(e, false); }).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><p>No reviewed entries yet.</p></div>';
}

function renderStudentsList() {
  const el = document.getElementById('students-cards');
  if (!el) return;
  if (!supervisorStudentsCache.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No students assigned yet.</p></div>';
    return;
  }
  el.innerHTML = supervisorStudentsCache.map(function(p) {
    const student = p.profiles || {};
    const name = student.full_name || 'Unknown';
    const initials = name.split(' ').map(function(n) { return n[0]; }).join('');
    const studentEntries = supervisorEntriesCache.filter(function(e) { return e.studentName === name; });
    const verifiedCount = studentEntries.filter(function(e) { return e.status === 'verified'; }).length;
    return '<div class="card" style="margin-bottom:12px;">' +
      '<div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div style="width:38px;height:38px;background:var(--accent-grad);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">' + initials + '</div>' +
          '<div>' +
            '<div style="font-size:13.5px;font-weight:600;">' + name + '</div>' +
            '<div style="font-size:11px;color:var(--slate-400);">' + (student.admission_number || '—') + ' · ' + p.organisation_name + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
          '<div style="text-align:center;">' +
            '<div style="font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--slate-900);">' + studentEntries.length + '</div>' +
            '<div style="font-size:10px;color:var(--slate-400);text-transform:uppercase;letter-spacing:.05em;">Entries</div>' +
          '</div>' +
          '<div style="text-align:center;">' +
            '<div style="font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--emerald);">' + verifiedCount + '</div>' +
            '<div style="font-size:10px;color:var(--slate-400);text-transform:uppercase;letter-spacing:.05em;">Verified</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="openEvaluationModal(\'' + p.id + '\',\'' + p.student_id + '\',\'' + name.replace(/'/g,"\\'") + '\')">🏆 Evaluate</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="exportSupervisorStudentReport(\'' + p.id + '\')">⬇ Report</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function evaluationCardHTML(ev) {
  const labels = { punctuality:'Punctuality & attendance', technical:'Technical capability', softskills:'Soft skills & teamwork', attendance:'Initiative & reliability' };
  const avg = ((ev.punctuality + ev.technical + ev.softskills + ev.attendance) / 4).toFixed(1);
  return '<div class="eval-card">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
      '<div>' +
        '<div style="font-size:13.5px;font-weight:600;text-transform:capitalize;">' + (ev.milestone_type === 'final' ? 'Final appraisal' : 'Mid-term appraisal') + '</div>' +
        '<div style="font-size:10.5px;color:var(--slate-400);margin-top:2px;">' + (ev.created_at ? new Date(ev.created_at).toLocaleDateString() : '') + '</div>' +
      '</div>' +
      '<div style="text-align:right;"><div class="eval-score-badge">' + avg + '/5</div><div style="font-size:9.5px;color:var(--slate-400);text-transform:uppercase;">Overall</div></div>' +
    '</div>' +
    '<div style="margin-top:12px;">' +
      '<div class="rubric-row"><span class="rubric-label">Punctuality &amp; attendance</span><strong>' + ev.punctuality + '/5</strong></div>' +
      '<div class="rubric-row"><span class="rubric-label">Technical capability</span><strong>' + ev.technical + '/5</strong></div>' +
      '<div class="rubric-row"><span class="rubric-label">Soft skills &amp; teamwork</span><strong>' + ev.softskills + '/5</strong></div>' +
      '<div class="rubric-row"><span class="rubric-label">Initiative &amp; reliability</span><strong>' + ev.attendance + '/5</strong></div>' +
    '</div>' +
    (ev.comments ? '<div class="feedback-box" style="margin-top:10px;"><div class="feedback-label">Comments</div><div class="feedback-text">"' + ev.comments + '"</div></div>' : '') +
  '</div>';
}

function renderSvEvaluations() {
  const el = document.getElementById('sv-evaluations-list');
  if (!el) return;
  if (!supervisorEvaluationsCache.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>No evaluations submitted yet. Open a student from "My Students" to evaluate them.</p></div>';
    return;
  }
  const byPlacement = {};
  supervisorEvaluationsCache.forEach(function(ev) {
    byPlacement[ev.placement_id] = byPlacement[ev.placement_id] || [];
    byPlacement[ev.placement_id].push(ev);
  });
  el.innerHTML = Object.keys(byPlacement).map(function(plId) {
    const placement = supervisorStudentsCache.find(function(p) { return p.id === plId; });
    const name = placement && placement.profiles ? placement.profiles.full_name : 'Student';
    return '<div style="font-size:12.5px;font-weight:700;margin:14px 0 6px;">' + name + '</div>' +
      byPlacement[plId].map(evaluationCardHTML).join('');
  }).join('');
}

// ════════════════════════════════════════════════════════════
// EVALUATIONS (SUPERVISOR fills, STUDENT views)
// ════════════════════════════════════════════════════════════
function openEvaluationModal(placementId, studentId, studentName) {
  evaluatingPlacement = { placement_id: placementId, student_id: studentId, studentName: studentName };
  document.getElementById('eval-modal-title').textContent = 'Evaluate — ' + studentName;
  document.getElementById('eval-milestone').value = 'midterm';
  document.getElementById('eval-punctuality').value = '5';
  document.getElementById('eval-technical').value = '5';
  document.getElementById('eval-softskills').value = '5';
  document.getElementById('eval-attendance').value = '5';
  document.getElementById('eval-comments').value = '';
  document.getElementById('eval-error').style.display = 'none';
  openModal('modal-evaluation');
}

async function submitEvaluation() {
  const errEl = document.getElementById('eval-error');
  const comments = document.getElementById('eval-comments').value.trim();
  if (!comments) {
    errEl.textContent = 'Please add overall comments before saving.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';

  const { error } = await sb.from('evaluations').insert({
    placement_id: evaluatingPlacement.placement_id,
    student_id: evaluatingPlacement.student_id,
    supervisor_id: currentUser.id,
    milestone_type: document.getElementById('eval-milestone').value,
    punctuality: parseInt(document.getElementById('eval-punctuality').value),
    technical: parseInt(document.getElementById('eval-technical').value),
    softskills: parseInt(document.getElementById('eval-softskills').value),
    attendance: parseInt(document.getElementById('eval-attendance').value),
    comments: comments,
  });

  if (error) {
    errEl.textContent = 'Could not save evaluation: ' + error.message;
    errEl.style.display = 'block';
    console.error(error);
    return;
  }

  closeModal('modal-evaluation');
  supervisorEvaluationsCache = await fetchSupervisorEvaluations();
  renderSection(activeTab);
  toast('Evaluation saved.', 'success');
}

// ════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════
let adminPlacementsCache = [];
let adminStudentsCache = [];
let adminEntriesCache = [];
let adminEvaluationsCache = [];

async function fetchAdminData() {
  const [placementsRes, studentsRes, entriesRes, evaluationsRes] = await Promise.all([
    sb.from('placements').select('*, student:student_id(full_name, admission_number), uni_sup:university_supervisor_id(full_name)').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').eq('role', 'student'),
    sb.from('logbook_entries').select('*, feedback(*), entry_attachments(*), profiles:student_id(full_name)').order('entry_date', { ascending: false }),
    sb.from('evaluations').select('*'),
  ]);

  if (placementsRes.error) console.error(placementsRes.error);
  if (studentsRes.error) console.error(studentsRes.error);
  if (entriesRes.error) console.error(entriesRes.error);
  if (evaluationsRes.error) console.error(evaluationsRes.error);

  return {
    placements: placementsRes.data || [],
    students: studentsRes.data || [],
    evaluations: evaluationsRes.data || [],
    entries: (entriesRes.data || []).map(function(e) {
      const fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
      return {
        id: e.id, title: e.title, type: e.entry_type, date: e.entry_date,
        activities: e.activities, learning: e.learning_points, challenges: e.challenges,
        status: e.status, feedback: fb ? fb.comments : null, score: fb ? fb.score : null,
        reviewer: null, studentId: e.student_id,
        studentName: e.profiles ? e.profiles.full_name : 'Unknown',
        attachments: e.entry_attachments || [],
        created_at: e.created_at,
      };
    }),
  };
}

async function buildAdminDash() {
  document.getElementById('main-content').innerHTML = '<div class="page-header"><div class="page-title">Loading...</div></div>';

  const data = await fetchAdminData();
  adminPlacementsCache = data.placements;
  adminStudentsCache = data.students;
  adminEntriesCache = data.entries;
  adminEvaluationsCache = data.evaluations;

  buildNav([
    { tab:'admin-overview', icon:'📊', label:'Overview', active:true },
    { tab:'placements',     icon:'🏢', label:'Placements' },
    { tab:'all-students',   icon:'👥', label:'All Students' },
    { tab:'all-entries',    icon:'📝', label:'All Entries' },
  ]);

  const totalStudents = adminStudentsCache.length;
  const totalEntries  = adminEntriesCache.length;
  const pendingCount  = adminEntriesCache.filter(function(e) { return e.status === 'pending'; }).length;
  const adminPlacementLike = adminPlacementsCache.map(function(p) { return { student_id: p.student_id, start_date: p.start_date, profiles: p.student, id: p.id }; });
  const flags = computeSupervisorFlags(adminEntriesCache, adminPlacementLike);

  const tickerItems = [
    '👥 <b>' + totalStudents + '</b> students in the system',
    '🏢 <b>' + adminPlacementsCache.length + '</b> active placements',
    '📝 <b>' + totalEntries + '</b> logbook entries logged so far',
    pendingCount > 0 ? ('🕐 <b>' + pendingCount + '</b> entries still unreviewed') : '✅ Every entry has been reviewed',
  ];

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Admin dashboard</div>' +
        '<div class="page-subtitle">Department of ICT &amp; Engineering — Attachment Management</div>' +
      '</div>' +
      '<button class="btn btn-dark" onclick="openPlacementModal()">+ Assign placement</button>' +
    '</div>' +
    insightTickerHTML(tickerItems) +
    '<div class="stat-row">' +
      '<div class="stat-card"><div class="stat-label">Total students</div><div class="stat-value" data-count="' + totalStudents + '">0</div></div>' +
      '<div class="stat-card"><div class="stat-label">Active placements</div><div class="stat-value" data-count="' + adminPlacementsCache.length + '">0</div></div>' +
      '<div class="stat-card"><div class="stat-label">Total entries</div><div class="stat-value" data-count="' + totalEntries + '">0</div></div>' +
      '<div class="stat-card accent-amber"><div class="stat-label">Unreviewed</div><div class="stat-value" data-count="' + pendingCount + '">0</div></div>' +
    '</div>' +
    '<div class="content-section active" id="section-admin-overview">' +
      '<div id="admin-flags"></div>' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Active placements summary</span></div>' +
        '<div style="overflow-x:auto;"><table class="data-table" id="admin-pl-table"></table></div>' +
      '</div>' +
    '</div>' +
    '<div class="content-section" id="section-placements">' +
      '<div class="toolbar"><button class="btn btn-dark btn-sm" onclick="openPlacementModal()">+ New placement</button></div>' +
      '<div class="card"><div style="overflow-x:auto;"><table class="data-table" id="placements-table"></table></div></div>' +
    '</div>' +
    '<div class="content-section" id="section-all-students">' +
      '<div class="card"><div style="overflow-x:auto;"><table class="data-table" id="all-students-table"></table></div></div>' +
    '</div>' +
    '<div class="content-section" id="section-all-entries"><div id="all-entries-list"></div></div>';

  animateAllStats();
  renderFlagsInto('admin-flags', flags);
  renderAdminOverview();
  activeTab = 'admin-overview';

  const sel = document.getElementById('pl-student');
  if (sel) {
    sel.innerHTML = adminStudentsCache.map(function(s) {
      return '<option value="' + s.id + '">' + s.full_name + (s.admission_number ? ' (' + s.admission_number + ')' : '') + '</option>';
    }).join('') || '<option value="">No students registered yet</option>';
  }
}

function placementRowHTML(p) {
  const studentName = p.student ? p.student.full_name : 'Unknown';
  const studentAdm  = p.student ? (p.student.admission_number || '') : '';
  const supName = p.uni_sup ? p.uni_sup.full_name : '—';
  return '<tr>' +
    '<td><strong>' + studentName + '</strong><br><span style="font-size:10px;color:var(--slate-400);">' + studentAdm + '</span></td>' +
    '<td>' + p.organisation_name + '</td>' +
    '<td>' + supName + '</td>' +
    '<td>' + (p.start_date || '—') + '</td>' +
    '<td>' + (p.end_date || '—') + '</td>' +
    '<td><span class="status-pill verified"><span class="pill-dot"></span>' + p.status + '</span></td>' +
    '<td><button class="btn btn-ghost btn-sm" onclick="exportSupervisorStudentReport(\'' + p.id + '\')">⬇ Report</button></td>' +
    '</tr>';
}

function placementsTableHTML(tableId) {
  const el = document.getElementById(tableId);
  if (!el) return;
  el.innerHTML = '<thead><tr><th>Student</th><th>Organisation</th><th>Supervisor</th><th>Start</th><th>End</th><th>Status</th><th>Report</th></tr></thead><tbody>' +
    (adminPlacementsCache.length ? adminPlacementsCache.map(placementRowHTML).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--slate-400);">No placements yet.</td></tr>') +
    '</tbody>';
}

function renderAdminOverview() { placementsTableHTML('admin-pl-table'); }
function renderPlacements()    { placementsTableHTML('placements-table'); }

function renderAllStudents() {
  const el = document.getElementById('all-students-table');
  if (!el) return;
  el.innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>Entries</th><th>Verified</th><th>Pending</th></tr></thead><tbody>' +
    (adminStudentsCache.length ? adminStudentsCache.map(function(s) {
      const ents = adminEntriesCache.filter(function(e) { return e.studentId === s.id; });
      const verifiedCount = ents.filter(function(e) { return e.status === 'verified'; }).length;
      const pendingCount  = ents.filter(function(e) { return e.status === 'pending'; }).length;
      return '<tr>' +
        '<td><strong>' + s.full_name + '</strong></td>' +
        '<td style="color:var(--slate-500);">' + s.email + '</td>' +
        '<td>' + ents.length + '</td>' +
        '<td style="color:var(--emerald);font-weight:700;">' + verifiedCount + '</td>' +
        '<td style="color:var(--amber);font-weight:700;">' + pendingCount + '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);">No students registered yet.</td></tr>') +
    '</tbody>';
}

function renderAllEntries() {
  const el = document.getElementById('all-entries-list');
  if (!el) return;
  el.innerHTML = adminEntriesCache.length
    ? adminEntriesCache.map(function(e) { return entryWithStudentLabel(e) + entryCardHTML(e, false); }).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><p>No entries in the system yet.</p></div>';
}

// ════════════════════════════════════════════════════════════
// SHARED: ENTRY CARD RENDERING
// ════════════════════════════════════════════════════════════
function entryCardHTML(entry, showActions) {
  const statusLabels = { verified:'Verified', pending:'Pending review', revision:'Needs revision' };
  const label = statusLabels[entry.status] || entry.status;
  const feedbackHTML = entry.feedback ?
    '<div class="feedback-box">' +
      '<div class="feedback-label">Supervisor feedback</div>' +
      '<div class="feedback-text">"' + entry.feedback + '"</div>' +
      (entry.score != null ? '<div class="feedback-by">Score: <strong>' + entry.score + '/10</strong></div>' : '') +
    '</div>' : '';
  const actionsHTML = (showActions && entry.status === 'pending') ?
    '<div class="entry-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="openReviewModal(\'' + entry.id + '\')">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>' +
        'Review entry' +
      '</button>' +
    '</div>' : '';

  return '<div class="entry-card ' + entry.status + '">' +
    '<div class="entry-header">' +
      '<div>' +
        '<div class="entry-title">' + entry.title + '</div>' +
        '<div class="entry-meta">' +
          '<span class="entry-date">' + entry.date + ' · ' + (entry.type === 'weekly' ? 'Weekly summary' : 'Daily entry') + '</span>' +
          '<span class="status-pill ' + entry.status + '"><span class="pill-dot"></span>' + label + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="entry-body">' + entry.activities + '</div>' +
    (entry.learning ? '<div class="entry-body" style="margin-top:6px;"><strong style="color:var(--slate-700);">Learning: </strong>' + entry.learning + '</div>' : '') +
    attachmentsHTML(entry.attachments) +
    feedbackHTML +
    actionsHTML +
    '</div>';
}

// ════════════════════════════════════════════════════════════
// SUBMIT ENTRY (STUDENT)
// ════════════════════════════════════════════════════════════
async function submitEntry() {
  const title      = document.getElementById('entry-title').value.trim();
  const activities = document.getElementById('entry-activities').value.trim();
  const date       = document.getElementById('entry-date').value;
  const type       = document.getElementById('entry-type').value;
  const learning   = document.getElementById('entry-learning').value.trim();
  const challenges = document.getElementById('entry-challenges').value.trim();
  const errEl      = document.getElementById('entry-error');

  if (!title || !activities || !date) {
    errEl.textContent = 'Please fill in the date, title, and activities fields.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';

  const { data: inserted, error } = await sb.from('logbook_entries').insert({
    student_id: currentUser.id,
    placement_id: myPlacementCache ? myPlacementCache.id : null,
    entry_date: date,
    entry_type: type,
    title: title,
    activities: activities,
    learning_points: learning || null,
    challenges: challenges || null,
    status: 'pending',
  }).select().single();

  if (error) {
    errEl.textContent = 'Could not submit entry: ' + error.message;
    errEl.style.display = 'block';
    console.error(error);
    return;
  }

  if (pendingAttachmentFiles.length) {
    await uploadAttachments(inserted.id);
  }

  closeModal('modal-entry');
  ['entry-title','entry-activities','entry-learning','entry-challenges'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('entry-attachments').value = '';
  document.getElementById('entry-attachments-preview').innerHTML = '';

  myEntriesCache = await fetchMyEntries();
  renderSection(activeTab);
  renderStudentOverview();
  toast('Entry submitted for review.', 'success');
}

// ════════════════════════════════════════════════════════════
// REVIEW MODAL (SUPERVISOR)
// ════════════════════════════════════════════════════════════
function openReviewModal(entryId) {
  const entry = supervisorEntriesCache.find(function(e) { return e.id === entryId; })
    || adminEntriesCache.find(function(e) { return e.id === entryId; });
  if (!entry) return;
  reviewingEntryId = entryId;
  document.getElementById('review-modal-title').textContent = 'Review: ' + entry.title;
  document.getElementById('review-entry-content').innerHTML =
    '<div style="font-size:13.5px;font-weight:600;margin-bottom:6px;">' + entry.title + '</div>' +
    '<div style="font-size:11px;color:var(--slate-400);margin-bottom:10px;">' + entry.date + '</div>' +
    '<div style="font-size:12.5px;color:var(--slate-700);line-height:1.7;">' + entry.activities + '</div>' +
    (entry.learning ? '<div style="margin-top:8px;font-size:12.5px;color:var(--slate-700);"><strong>Learning:</strong> ' + entry.learning + '</div>' : '') +
    (entry.challenges ? '<div style="margin-top:6px;font-size:12.5px;color:var(--slate-700);"><strong>Challenges:</strong> ' + entry.challenges + '</div>' : '') +
    attachmentsHTML(entry.attachments);
  document.getElementById('review-feedback').value  = '';
  document.getElementById('review-score').value     = '';
  document.getElementById('review-decision').value  = 'verified';
  document.getElementById('review-error').style.display = 'none';
  openModal('modal-review');
}

async function submitReview() {
  const feedback = document.getElementById('review-feedback').value.trim();
  const score    = document.getElementById('review-score').value;
  const decision = document.getElementById('review-decision').value;
  const errEl    = document.getElementById('review-error');

  if (!feedback) {
    errEl.textContent = 'Please write feedback before submitting.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';

  const { error: fbError } = await sb.from('feedback').insert({
    entry_id: reviewingEntryId,
    supervisor_id: currentUser.id,
    comments: feedback,
    score: score ? parseInt(score) : null,
    status: decision,
  });

  if (fbError) {
    errEl.textContent = 'Could not save feedback: ' + fbError.message;
    errEl.style.display = 'block';
    console.error(fbError);
    return;
  }

  const { error: enError } = await sb.from('logbook_entries')
    .update({ status: decision })
    .eq('id', reviewingEntryId);

  if (enError) console.error(enError);

  closeModal('modal-review');

  if (currentUser.role === 'admin') {
    const data = await fetchAdminData();
    adminEntriesCache = data.entries;
  } else {
    const result = await fetchSupervisorEntries();
    supervisorEntriesCache = result.entries;
  }
  renderSection(activeTab);
  renderSvOverview();
  toast(decision === 'verified' ? 'Entry approved and verified.' : 'Revision requested.', decision === 'verified' ? 'success' : 'warn');
}

// ════════════════════════════════════════════════════════════
// PLACEMENT (ADMIN)
// ════════════════════════════════════════════════════════════
function openPlacementModal() {
  document.getElementById('placement-error') && (document.getElementById('placement-error').style.display = 'none');
  openModal('modal-placement');
}

async function savePlacement() {
  const studentId = document.getElementById('pl-student').value;
  const org       = document.getElementById('pl-org').value.trim();
  const start     = document.getElementById('pl-start').value;
  const end       = document.getElementById('pl-end').value;

  if (!studentId || !org) { toast('Please select a student and enter an organisation name.', 'warn'); return; }

  const { error } = await sb.from('placements').insert({
    student_id: studentId,
    organisation_name: org,
    start_date: start || null,
    end_date: end || null,
    status: 'active',
  });

  if (error) { toast('Could not save placement: ' + error.message, 'warn'); console.error(error); return; }

  closeModal('modal-placement');
  const data = await fetchAdminData();
  adminPlacementsCache = data.placements;
  renderSection(activeTab);
  toast('Placement saved.', 'success');
}

// ════════════════════════════════════════════════════════════
// AUTOMATED FINAL REPORT EXPORT (PDF)
// ════════════════════════════════════════════════════════════
function buildReportHTML(opts) {
  const student = opts.student;
  const placement = opts.placement;
  const entries = opts.entries.filter(function(e) { return e.status === 'verified'; });
  const evaluations = opts.evaluations || [];

  const entriesRows = entries.length ? entries.map(function(e) {
    return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">' + e.date + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">' + e.title + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">' + (e.activities || '').replace(/</g,'&lt;') + '</td>' +
      (e.score != null ? '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">' + e.score + '/10</td>' : '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">—</td>') +
      '</tr>';
  }).join('') : '<tr><td colspan="4" style="padding:10px;font-size:11px;color:#888;">No verified entries yet.</td></tr>';

  const evalBlocks = evaluations.length ? evaluations.map(function(ev) {
    const avg = ((ev.punctuality + ev.technical + ev.softskills + ev.attendance) / 4).toFixed(1);
    return '<div style="margin-bottom:10px;padding:10px;border:1px solid #e2e8f0;border-radius:6px;">' +
      '<strong style="font-size:12px;text-transform:capitalize;">' + (ev.milestone_type === 'final' ? 'Final appraisal' : 'Mid-term appraisal') + ' — ' + avg + '/5</strong>' +
      '<div style="font-size:11px;color:#444;margin-top:4px;">Punctuality: ' + ev.punctuality + '/5 · Technical: ' + ev.technical + '/5 · Soft skills: ' + ev.softskills + '/5 · Initiative: ' + ev.attendance + '/5</div>' +
      (ev.comments ? '<div style="font-size:11px;color:#444;margin-top:4px;font-style:italic;">"' + ev.comments + '"</div>' : '') +
    '</div>';
  }).join('') : '<p style="font-size:11px;color:#888;">No evaluations submitted yet.</p>';

  return '<div style="font-family:Georgia,serif;color:#1b1440;padding:24px;">' +
    '<div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #3f2fce;padding-bottom:14px;">' +
      '<div style="font-size:19px;font-weight:700;">Student Industrial Attachment Report</div>' +
      '<div style="font-size:11px;color:#666;margin-top:4px;">Department of ICT &amp; Engineering — Zetech University</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;font-size:12px;">' +
      '<div><strong>Student:</strong> ' + (student ? student.name : '—') + '</div>' +
      '<div><strong>Admission No.:</strong> ' + (student && student.admission ? student.admission : '—') + '</div>' +
      '<div><strong>Organisation:</strong> ' + (placement ? placement.organisation_name : '—') + '</div>' +
      '<div><strong>Duration:</strong> ' + (placement ? (placement.start_date || '—') + ' to ' + (placement.end_date || '—') : '—') + '</div>' +
    '</div>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Verified Logbook Entries (' + entries.length + ')</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:18px;"><thead><tr>' +
      '<th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#888;border-bottom:2px solid #e2e8f0;">Date</th>' +
      '<th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#888;border-bottom:2px solid #e2e8f0;">Title</th>' +
      '<th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#888;border-bottom:2px solid #e2e8f0;">Activities</th>' +
      '<th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#888;border-bottom:2px solid #e2e8f0;">Score</th>' +
      '</tr></thead><tbody>' + entriesRows + '</tbody></table>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Supervisor Evaluations</div>' +
    evalBlocks +
    '<div style="margin-top:24px;font-size:10px;color:#999;text-align:center;">Generated by SITS on ' + new Date().toLocaleDateString() + '</div>' +
  '</div>';
}

function downloadReport(html, filename) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set({ filename: filename, margin: 0, html2canvas: { scale: 2 } }).from(container).save().then(function() {
    document.body.removeChild(container);
  }).catch(function(err) {
    console.error(err);
    document.body.removeChild(container);
    toast('Could not generate PDF. Check your connection.', 'warn');
  });
}

async function exportStudentReport() {
  toast('Generating your report...', 'info');
  const evals = myEvaluationsCache && myEvaluationsCache.length ? myEvaluationsCache : await fetchMyEvaluations();
  const html = buildReportHTML({
    student: currentUser,
    placement: myPlacementCache,
    entries: myEntriesCache,
    evaluations: evals,
  });
  downloadReport(html, (currentUser.name || 'student') + '-attachment-report.pdf');
}

async function exportSupervisorStudentReport(placementId) {
  const placement = (supervisorStudentsCache.find(function(p) { return p.id === placementId; })) ||
    (adminPlacementsCache.find(function(p) { return p.id === placementId; }));
  if (!placement) { toast('Placement not found.', 'warn'); return; }
  const studentProfile = placement.profiles || placement.student || {};
  toast('Generating report...', 'info');

  const { data: entries } = await sb.from('logbook_entries').select('*, feedback(*)').eq('placement_id', placementId).order('entry_date', { ascending: false });
  const mappedEntries = (entries || []).map(function(e) {
    const fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
    return { title: e.title, date: e.entry_date, activities: e.activities, status: e.status, score: fb ? fb.score : null };
  });
  const { data: evals } = await sb.from('evaluations').select('*').eq('placement_id', placementId);

  const html = buildReportHTML({
    student: { name: studentProfile.full_name, admission: studentProfile.admission_number },
    placement: { organisation_name: placement.organisation_name, start_date: placement.start_date, end_date: placement.end_date },
    entries: mappedEntries,
    evaluations: evals || [],
  });
  downloadReport(html, (studentProfile.full_name || 'student') + '-attachment-report.pdf');
}

// ════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════
function openModal(id) {
  if (id === 'modal-entry') {
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
  }
  document.getElementById(id).classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

