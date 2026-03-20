// DOM elements
const vibrationSwitch     = document.getElementById('vibrationSwitch');
const pages               = document.querySelectorAll('.page');
const buttons             = document.querySelectorAll('.nav-item');
const mdButtons           = document.querySelectorAll('.md-btn');
const doorStatusEl        = document.getElementById('doorStatus');
const currentTimeEl       = document.getElementById('currentTime');
const eventListEl         = document.getElementById('eventList');
const lastOpenedEl        = document.getElementById('LastOpened');
const fullDatBtn          = document.getElementById('fulldat');
const latestDatBtn        = document.getElementById('latestdat');
const viewDatBtn          = document.getElementById('viewdat');
const alertToggle         = document.getElementById('alertToggle');
const alertSwitch         = document.getElementById('alertSwitch');
const darkModeSwitch      = document.getElementById('darkModeSwitch');
const contrastSwitch      = document.getElementById('contrastSwitch');
const reduceMotionSwitch  = document.getElementById('reduceMotionSwitch');
const themeMeta           = document.querySelector('meta[name="theme-color"]');

window.API_KEY = localStorage.getItem('api_url') || '';

// vibration
let vibrationEnabled = localStorage.getItem('vibration') !== 'off';
if (vibrationSwitch) vibrationSwitch.checked = !vibrationEnabled;

const _vibrate = navigator.vibrate.bind(navigator);
navigator.vibrate = (pattern) => {
  if (vibrationEnabled) return _vibrate(pattern);
  return false;
};

if (vibrationSwitch) {
  vibrationSwitch.addEventListener('change', () => {
    vibrationEnabled = !vibrationSwitch.checked;
    localStorage.setItem('vibration', vibrationEnabled ? 'on' : 'off');
  });
}

// state
let doorOpenTimer    = null;
let doorOpenInterval = null;
let alertDisabled    = false;
let alertEnabled     = true;
let isDownloading    = false;

// clock
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  currentTimeEl.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// alert switch
if (alertSwitch) {
  alertEnabled = localStorage.getItem('alert') === 'on';
  alertSwitch.checked = alertEnabled;

  alertSwitch.addEventListener('change', () => {
    alertEnabled = alertSwitch.checked;
    localStorage.setItem('alert', alertEnabled ? 'on' : 'off');

    if (!alertEnabled && doorOpenInterval) {
      clearInterval(doorOpenInterval);
      doorOpenInterval = null;
      alertToggle.textContent = 'No Alert';
      doorStatusEl.style.color = '';
      alertDisabled = false;
    }
  });
}

// add logs row
function addEvent(text, time = null) {
  const li = document.createElement('li');
  li.textContent = `${time || new Date().toLocaleTimeString()} — ${text}`;
  eventListEl.prepend(li);
}

// format
function formatAMPM(date) {
  if (!(date instanceof Date) || isNaN(date)) return '-';
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// fetch sheet
async function fetchSheetData() {
  try {
    const res = await fetch(window.API_KEY);
    const raw = await res.json();
    const rows = raw.values || raw || [];

    const history = rows.slice(0).reverse().map(row => {
      let door    = row.door || row[2] || 'UNKNOWN';
      let rawTime = row.time || row[0];
      let rawDate = row.date || row[1];

      let time = '-', date = '-';
      if (rawTime) { const d = new Date(rawTime); if (!isNaN(d)) time = formatAMPM(d); }
      if (rawDate) { const d = new Date(rawDate); if (!isNaN(d)) date = formatDate(d); }
      return { time, date, door };
    });

    const lastRow    = history[0] || { door: 'UNKNOWN' };
    const lastOpened = history.find(e => e.door === 'OPEN');
    return { current: { door: lastRow.door }, history, lastOpened: lastOpened || null };
  } catch (err) {
    console.error('fetch failed', err);
    return null;
  }
}

async function fetchServerData() {
  try {
    const data = await fetchSheetData();
    if (!data) return;

    doorStatusEl.textContent = data.current.door;

    eventListEl.innerHTML = '';
    data.history.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.time} | ${item.date} - ${item.door}`;
      eventListEl.append(li);
    });

    lastOpenedEl.textContent = data.lastOpened
      ? `${data.lastOpened.time} | ${data.lastOpened.date}`
      : '-';
  } catch (err) {
    console.error('UI update failed', err);
  }
}

// sheets url
viewDatBtn?.addEventListener('click', () => {
  const url = localStorage.getItem('sheets_url');
  if (!url) return;
  window.open(url, '_blank');
});

// download
async function downloadCSV(filename, limit = null) {
  if (isDownloading) return;
  isDownloading = true;

  const btn      = limit ? latestDatBtn : fullDatBtn;
  const otherBtn = limit ? fullDatBtn : latestDatBtn;
  const origText = btn.textContent;

  btn.textContent   = '';
  btn.disabled      = true;
  otherBtn.disabled = true;

  const spinner = document.createElement('md-circular-progress');
  spinner.setAttribute('indeterminate', '');
  btn.appendChild(spinner);

  try {
    const data = await fetchSheetData();
    if (!data) return;

    const rows = limit ? data.history.slice(0, limit) : data.history;
    const csv  = ['Time,Date,Door']
      .concat(rows.map(e => `${e.time},${e.date},${e.door}`))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  } finally {
    spinner.remove();
    btn.textContent   = origText;
    btn.disabled      = false;
    otherBtn.disabled = false;
    isDownloading     = false;
  }
}

fullDatBtn.addEventListener('click',   () => downloadCSV('full_records.csv'));
latestDatBtn.addEventListener('click', () => downloadCSV('latest_records.csv', 50));

// navigation
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(32);
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.page).classList.add('active');
  });
});

// ripple effect
mdButtons.forEach(btn => {
  btn.addEventListener('click', e => {
    const circle = document.createElement('span');
    circle.classList.add('ripple');
    btn.appendChild(circle);
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    circle.style.width  = circle.style.height = d + 'px';
    circle.style.left   = e.clientX - btn.getBoundingClientRect().left - d / 2 + 'px';
    circle.style.top    = e.clientY - btn.getBoundingClientRect().top  - d / 2 + 'px';
    circle.classList.add('ripple-animate');
    circle.addEventListener('animationend', () => circle.remove());
  });
});

// theme
function getCurrentTheme() {
  return document.body.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(theme);
}

function applyContrastForCurrentTheme() {
  document.body.classList.remove('contrast-light', 'contrast-dark');
  if (!contrastSwitch.checked) return;
  document.body.classList.add(getCurrentTheme() === 'dark' ? 'contrast-dark' : 'contrast-light');
}

// theme color meta
function updateThemeColor() {
  const bg = getComputedStyle(document.body)
    .getPropertyValue('--md-sys-color-surface')
    .trim();
  themeMeta?.setAttribute('content', bg || defaultMetaColor);
}

// theme again
darkModeSwitch.addEventListener('change', () => {
  const theme = darkModeSwitch.checked ? 'dark' : 'light';
  applyTheme(theme);
  applyContrastForCurrentTheme();
  localStorage.setItem('theme', theme);
  updateThemeColor();
});

contrastSwitch.addEventListener('change', () => {
  applyContrastForCurrentTheme();
  localStorage.setItem('contrast', contrastSwitch.checked ? 'on' : 'off');
  updateThemeColor();
});

// restore settings
(function restoreSettings() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  darkModeSwitch.checked = savedTheme === 'dark';

  if (localStorage.getItem('contrast') === 'on') {
    contrastSwitch.checked = true;
    applyContrastForCurrentTheme();
  }
})();

updateThemeColor();

// reduce motion
reduceMotionSwitch.addEventListener('change', () => {
  document.body.classList.toggle('no-animation', reduceMotionSwitch.checked);
  localStorage.setItem('reduceMotion', reduceMotionSwitch.checked ? 'on' : 'off');
});

if (localStorage.getItem('reduceMotion') === 'on') {
  document.body.classList.add('no-animation');
  reduceMotionSwitch.checked = true;
}

// prevent zoom/select
document.addEventListener('contextmenu', e => e.preventDefault());
const configArea = document.querySelector('.user-config');

document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && configArea && !configArea.contains(e.target)) {
    e.preventDefault();
  }
});

document.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));

// register SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dormguard-app/sw.js');
}

// collapsible
document.querySelectorAll('.collapsible').forEach(header => {
  header.addEventListener('click', () => {
    const content = document.getElementById(header.dataset.target);
    const isOpen  = content.classList.contains('open');

    if (isOpen) {
      content.style.height = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.height = '0px';
        content.classList.remove('open');
        header.classList.remove('open');
      });
    } else {
      content.classList.add('open');
      header.classList.add('open');
      content.style.height = content.scrollHeight + 'px';

      setTimeout(() => {
        content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);

      content.addEventListener('transitionend', () => {
        if (content.classList.contains('open')) content.style.height = 'auto';
      }, { once: true });
    }
  });
});

// open setup shortcut
document.getElementById('openSetupBtn').addEventListener('click', () => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const settingsPage = document.getElementById('settings');
  settingsPage.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-item[data-page="settings"]').classList.add('active');

  const collapsible = document.querySelector('.settings-item.collapsible[data-target="apiConfig"]');
  const content     = document.getElementById(collapsible.dataset.target);

  setTimeout(() => {
    const targetSection = document.getElementById('configSection');
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setTimeout(() => {
        if (!content.classList.contains('open')) {
          collapsible.classList.add('open');
          content.classList.add('open', 'animating');
          content.style.height = content.scrollHeight + 'px';

          content.addEventListener('transitionend', () => {
            content.style.height = 'auto';
            content.classList.remove('animating');
            content.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, { once: true });
        }
      }, 350);
    }
  }, 1000);
});

setInterval(fetchServerData, 5000);
fetchServerData();
