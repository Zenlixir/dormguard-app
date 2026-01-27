// ------------------- DOM Elements -------------------
const pages = document.querySelectorAll('.page');
const buttons = document.querySelectorAll('.nav-item');
const mdButtons = document.querySelectorAll('.md-btn');

const doorStatusEl = document.getElementById('doorStatus');
const batteryLevelEl = document.getElementById('batteryLevel');
const eventListEl = document.getElementById('eventList');
const lastOpenedEl = document.getElementById('LastOpened');

const fullDatBtn = document.getElementById('fulldat');
const latestDatBtn = document.getElementById('latestdat');
const viewDatBtn = document.getElementById('viewdat');

const alertToggle = document.getElementById('alertToggle');

// ------------------- NAVIGATION -------------------
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.page).classList.add('active');
  });
});

// ------------------- DISABLE ALERT BUTTON -------------------
if (alertToggle) {
  alertToggle.addEventListener('click', async () => {
    addEvent('Alert Disabled');

    try {
      await fetch(`http://ESP32_IP_ADDRESS/alert?state=off`);
    } catch (err) {
      console.error('Failed to disable alert on ESP32:', err);
    }

    alertToggle.disabled = true;
    alertToggle.textContent = 'Alert Disabled';
  });
}

// ------------------- ADD EVENT TO LIST -------------------
function addEvent(text, time = null) {
  const li = document.createElement('li');
  li.textContent = `${time || new Date().toLocaleTimeString()} — ${text}`;
  eventListEl.prepend(li);
}

// ------------------- GOOGLE SHEETS CONFIG -------------------
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const API_KEY = 'YOUR_API_KEY';
const RANGE = 'Sheet1!A:D';

// ------------------- FETCH DATA FROM SHEET -------------------
async function fetchSheetData() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.values) return;

    eventListEl.innerHTML = '';

    data.values.slice(1).reverse().forEach(row => {
      const [time, event] = row;
      addEvent(event, time);
    });

    const lastRow = data.values[data.values.length - 1];
    doorStatusEl.textContent = lastRow[2] || 'UNKNOWN';
    batteryLevelEl.textContent = lastRow[3] || 'N/A';

    const openRow = [...data.values].reverse().find(r => r[2] === 'OPEN');
    lastOpenedEl.textContent = openRow ? openRow[0] : '-';

  } catch (err) {
    console.error('Error fetching sheet data:', err);
  }
}

// ------------------- DATABASE BUTTONS -------------------
viewDatBtn.addEventListener('click', () => {
  window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`, '_blank');
});

fullDatBtn.addEventListener('click', async () => {
  const csv = await fetchSheetCSV();
  downloadCSV(csv, 'full_records.csv');
});

latestDatBtn.addEventListener('click', async () => {
  const csv = await fetchSheetCSV();
  const rows = csv.split('\n');
  downloadCSV(rows.slice(-50).join('\n'), 'latest_records.csv');
});

async function fetchSheetCSV() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.values) return '';
    return data.values.map(r => r.join(',')).join('\n');
  } catch {
    return '';
  }
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ------------------- AUTO FETCH -------------------
setInterval(fetchSheetData, 5000);

// ------------------- MD BUTTON RIPPLE -------------------
mdButtons.forEach(btn => {
  btn.addEventListener('click', e => {
    const circle = document.createElement('span');
    circle.classList.add('ripple');
    btn.appendChild(circle);
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    circle.style.width = circle.style.height = d + 'px';
    circle.style.left = e.clientX - btn.getBoundingClientRect().left - d / 2 + 'px';
    circle.style.top = e.clientY - btn.getBoundingClientRect().top - d / 2 + 'px';
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
  document.body.classList.add(
    getCurrentTheme() === 'dark' ? 'contrast-dark' : 'contrast-light'
  );
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