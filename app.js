let doorOpenTimer = null;
let doorOpenInterval = null;
let alertDisabled = false;
let alertEnabled = true;

// ------------------- DOM Elements -------------------
const pages = document.querySelectorAll('.page');
const buttons = document.querySelectorAll('.nav-item');
const mdButtons = document.querySelectorAll('.md-btn');

const doorStatusEl = document.getElementById('doorStatus');
const currentTimeEl = document.getElementById('currentTime');
const eventListEl = document.getElementById('eventList');
const lastOpenedEl = document.getElementById('LastOpened');

const fullDatBtn = document.getElementById('fulldat');
const latestDatBtn = document.getElementById('latestdat');
const viewDatBtn = document.getElementById('viewdat');

const alertToggle = document.getElementById('alertToggle');
const alertSwitch = document.getElementById('alertSwitch');

function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  currentTimeEl.textContent = `${h}:${m}:${s}`;
}

setInterval(updateClock, 1000);
updateClock();

// ------------------- USER CONFIG: GOOGLE SCRIPT URL -------------------
const apiInput = document.querySelector('.sheets-input-container .md-input');
const saveConfigBtn = document.getElementById('saveConfig');
const resetConfigBtn = document.getElementById('resetConfig');

let API_KEY = localStorage.getItem('api_url') || '';

if (apiInput && API_KEY) {
  apiInput.value = API_KEY;
}

saveConfigBtn.addEventListener('click', () => {
  const url = apiInput.value.trim();
  if (!url.startsWith('http')) {
    return;
  }

  API_KEY = url.replace(/\/$/, '');
  localStorage.setItem('api_url', API_KEY);

  if (navigator.vibrate) navigator.vibrate(30);
});

resetConfigBtn.addEventListener('click', () => {
  apiInput.value = '';
  localStorage.removeItem('api_url');
  API_KEY = '';

  sheetsInput.value = '';
  localStorage.removeItem('sheets_url');

  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
});

// ------------------- NAVIGATION -------------------
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(32);
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.page).classList.add('active');
  });
});

// ------------------- ALERT SWITCH -------------------
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

// ------------------- ADD EVENT TO LIST -------------------
function addEvent(text, time = null) {
  const li = document.createElement('li');
  li.textContent = `${time || new Date().toLocaleTimeString()} — ${text}`;
  eventListEl.prepend(li);
}

// ------------------- GOOGLE SHEET STUFF -------------------
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

async function fetchSheetData() {
  try {
    const res = await fetch(API_KEY);
    const raw = await res.json();
    const rows = raw.values || raw || [];

    const history = rows.slice(0).reverse().map(row => {
      let door = row.door || row[2] || 'UNKNOWN';
      let rawTime = row.time || row[0];
      let rawDate = row.date || row[1];

      let time = '-', date = '-';
      if (rawTime) {
        const d = new Date(rawTime);
        if (!isNaN(d)) time = formatAMPM(d);
      }
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d)) date = formatDate(d);
      }
      return { time, date, door };
    });

    const lastRow = history[0] || { door: 'UNKNOWN' };
    const current = { door: lastRow.door };
    const lastOpened = history.find(e => e.door === 'OPEN');

    return { current, history, lastOpened: lastOpened || null };
  } catch (err) {
    console.error('Failed to fetch Google Sheet data', err);
    return null;
  }
}

// ------------------- FETCH DATA -------------------
async function fetchServerData() {
  try {
    const data = await fetchSheetData();
    if (!data) return;

    doorStatusEl.textContent = data.current.door;

    // ----- DOOR ALERT -----
    function handleDoorAlert() {
      if (!alertEnabled) {
        alertToggle.textContent = 'No Alert';
        doorStatusEl.style.color = '';
        if (doorOpenInterval) { clearInterval(doorOpenInterval); doorOpenInterval = null; }
        if (doorOpenTimer) { clearTimeout(doorOpenTimer); doorOpenTimer = null; }
        return;
      }

      if (doorStatusEl.textContent === 'OPEN') {
        if (!doorOpenTimer && !alertDisabled && !doorOpenInterval) {
          doorOpenTimer = setTimeout(() => {
            if (navigator.vibrate) {
              doorStatusEl.style.color = 'red';
              navigator.vibrate([500, 200, 500]);
              setTimeout(() => { doorStatusEl.style.color = ''; }, 1200);
            }
            alertToggle.textContent = 'Disable Alert';

            doorOpenInterval = setInterval(() => {
              if (navigator.vibrate) {
                doorStatusEl.style.color = 'red';
                navigator.vibrate([500, 200, 500]);
                setTimeout(() => { doorStatusEl.style.color = ''; }, 1200);
              }
            }, 5000);

            doorOpenTimer = null;
          }, 10000);
        }
      } else {
        alertToggle.textContent = 'No Alert';
        doorStatusEl.style.color = '';
        alertDisabled = false;
        if (doorOpenInterval) { clearInterval(doorOpenInterval); doorOpenInterval = null; }
        if (doorOpenTimer) { clearTimeout(doorOpenTimer); doorOpenTimer = null; }
      }
    }

    handleDoorAlert();

    eventListEl.innerHTML = '';
    data.history.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.time} | ${item.date} - ${item.door}`;
      eventListEl.append(li);
    });

    lastOpenedEl.textContent = data.lastOpened ? `${data.lastOpened.time} | ${data.lastOpened.date}` : '-';

  } catch (err) {
    console.error('Failed to update UI', err);
  }
}

// ------------------- DATABASE -------------------
const sheetsInput = document.querySelector('.md-input2');

const SAVED_SHEET = localStorage.getItem('sheets_url');
if (SAVED_SHEET && sheetsInput) sheetsInput.value = SAVED_SHEET;

sheetsInput?.addEventListener('input', () => {
  const url = sheetsInput.value.trim();
  if (!url) return;
  localStorage.setItem('sheets_url', url);
});

viewDatBtn?.addEventListener('click', () => {
  const url = sheetsInput.value.trim() || localStorage.getItem('sheets_url');
  if (!url) {
    return;
  }
  window.open(url, '_blank');
});

let isDownloading = false;

fullDatBtn.addEventListener('click', async () => {
  if (isDownloading) return;
  isDownloading = true;

  const originalText = fullDatBtn.textContent;

  fullDatBtn.textContent = '';
  fullDatBtn.disabled = true;
  latestDatBtn.disabled = true;

  const spinner = document.createElement('md-circular-progress');
  spinner.setAttribute('indeterminate', '');
  fullDatBtn.appendChild(spinner);

  try {
    const data = await fetchSheetData();
    if (!data) return;

    const csv = ['Time,Date,Door']
      .concat(data.history.map(e => `${e.time},${e.date},${e.door}`))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'full_records.csv';
    link.click();
  } finally {
    spinner.remove();
    fullDatBtn.textContent = originalText;
    fullDatBtn.disabled = false;
    latestDatBtn.disabled = false;
    isDownloading = false;
  }
});

latestDatBtn.addEventListener('click', async () => {
  if (isDownloading) return;
  isDownloading = true;

  const originalText = latestDatBtn.textContent;

  latestDatBtn.textContent = '';
  latestDatBtn.disabled = true;
  fullDatBtn.disabled = true;

  const spinner = document.createElement('md-circular-progress');
  spinner.setAttribute('indeterminate', '');
  latestDatBtn.appendChild(spinner);

  try {
    const data = await fetchSheetData();
    if (!data) return;

    const latest = data.history.slice(0, 50);
    const csv = ['Time,Date,Door']
      .concat(latest.map(e => `${e.time},${e.date},${e.door}`))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'latest_records.csv';
    link.click();
  } finally {
    spinner.remove();
    latestDatBtn.textContent = originalText;
    latestDatBtn.disabled = false;
    fullDatBtn.disabled = false;
    isDownloading = false;
  }
});

// ------------------- AUTO FETCH -------------------
setInterval(fetchServerData, 1000);
fetchServerData();
          
// ------------------- MD BUTTON RIPPLE -------------------          
mdButtons.forEach(btn => {          
  btn.addEventListener('click', e => {          
    const circle = document.createElement('span');          
    circle.classList.add('ripple');          
    btn.appendChild(circle);          
    const d = Math.max(btn.clientWidth, btn.clientHeight);          
    circle.style.width = circle.style.height = d + 'px';          
    circle.style.left = e.clientX - btn.getBoundingClientRect().left - d/2 + 'px';          
    circle.style.top = e.clientY - btn.getBoundingClientRect().top - d/2 + 'px';          
    circle.classList.add('ripple-animate');          
    circle.addEventListener('animationend', () => circle.remove());          
  });          
});          
          
// ------------------- THEME + CONTRAST -------------------          
const darkModeSwitch = document.getElementById('darkModeSwitch');          
const contrastSwitch = document.getElementById('contrastSwitch');          
          
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
          
(function restoreSettings() {          
  const savedTheme = localStorage.getItem('theme') || 'light';          
  applyTheme(savedTheme);          
  darkModeSwitch.checked = savedTheme === 'dark';          
          
  if (localStorage.getItem('contrast') === 'on') {          
    contrastSwitch.checked = true;          
    applyContrastForCurrentTheme();          
  }          
})();          
          
// ------------------- DISABLE ANIMATION -------------------          
const reduceMotionSwitch = document.getElementById('reduceMotionSwitch');          
          
reduceMotionSwitch.addEventListener('change', () => {          
  document.body.classList.toggle('no-animation', reduceMotionSwitch.checked);          
  localStorage.setItem('reduceMotion', reduceMotionSwitch.checked ? 'on' : 'off');          
});          
          
if (localStorage.getItem('reduceMotion') === 'on') {          
  document.body.classList.add('no-animation');          
  reduceMotionSwitch.checked = true;          
}          
          
// ------------------- THEME COLOR META -------------------          
const themeMeta = document.querySelector('meta[name="theme-color"]');          
const defaultMetaColor = 'rgb(235, 231, 231)';          
          
function updateThemeColor() {          
  const isPWA =          
    window.matchMedia('(display-mode: standalone)').matches ||          
    window.navigator.standalone === true;          
          
  if (isPWA || document.body.classList.contains('dark')) {          
    const bg = getComputedStyle(document.body)          
      .getPropertyValue('--md-sys-color-background')          
      .trim();          
    themeMeta?.setAttribute('content', bg);          
  } else {          
    themeMeta?.setAttribute('content', defaultMetaColor);          
  }          
}          
          
updateThemeColor();          
          
// ------------------- PREVENT ZOOM / SELECT -------------------          
document.addEventListener('contextmenu', e => e.preventDefault());          
const configArea = document.querySelector('.user-config');
          
document.addEventListener('pointerdown', e => {          
  if (e.pointerType === 'touch' && !configArea.contains(e.target)) {          
    e.preventDefault(); 
  }          
});          
document.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));

// ------------------- SERVICE WORKER -------------------   

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ------------------- SCROLL/EXPAND STUFF -------------------   

document.querySelectorAll('.collapsible').forEach(header => {
  header.addEventListener('click', () => {
    const content = document.getElementById(header.dataset.target);
    const isOpen = content.classList.contains('open');

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
        content.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 400);

      content.addEventListener('transitionend', () => {
        if (content.classList.contains('open')) {
          content.style.height = 'auto';
        }
      }, { once: true });
    }
  });
});

document.getElementById('openSetupBtn').addEventListener('click', () => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const settingsPage = document.getElementById('settings');
  settingsPage.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-item[data-page="settings"]').classList.add('active');

  const collapsible = document.querySelector('.settings-item.collapsible[data-target="apiConfig"]');
  const content = document.getElementById(collapsible.dataset.target);

  setTimeout(() => {
    const targetSection = document.getElementById('configSection');
    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      setTimeout(() => {
        if (!content.classList.contains('open')) {
          collapsible.classList.add('open');
          content.classList.add('open', 'animating');
          content.style.height = content.scrollHeight + 'px';

          content.addEventListener('transitionend', () => {
            content.style.height = 'auto';
            content.classList.remove('animating');

            content.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }, {
            once: true
          });
        }
      }, 350);
    }
  }, 1000);
});