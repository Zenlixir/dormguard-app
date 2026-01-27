// ------------------- DOM Elements -------------------
const pages = document.querySelectorAll('.page');
const buttons = document.querySelectorAll('.nav-item');
const mdButtons = document.querySelectorAll('.md-btn');

const doorStatusEl = document.getElementById('doorStatus');
const batteryLevelEl = document.getElementById('batteryLevel');
const eventListEl = document.getElementById('eventList');
const lastOpenedEl = document.getElementById('LastOpened');

const activeBtn = document.getElementById('activeBtn');
const nonactiveBtn = document.getElementById('nonactiveBtn');

const fullDatBtn = document.getElementById('fulldat');
const latestDatBtn = document.getElementById('latestdat');
const viewDatBtn = document.getElementById('viewdat');

const alertToggle = document.getElementById('alertToggle'); 

let active = false;

// ------------------- NAVIGATION -------------------
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.page).classList.add('active');
  });
});

// ------------------- ACTIVE / NON-ACTIVE -------------------
activeBtn.addEventListener('click', () => { active = true; addEvent('System Activated'); });
nonactiveBtn.addEventListener('click', () => { active = false; addEvent('System Deactivated'); });

// ------------------- DISABLE ALERT BUTTON -------------------
if (alertToggle) {
  alertToggle.addEventListener('click', async () => {
    addEvent('Alert Disabled');

    // Send HTTP request to ESP32 to stop alert
    try {
      await fetch(`http://ESP32_IP_ADDRESS/alert?state=off`); // No esp yet :(
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
const RANGE = 'Sheet1!A:D'; // Columns: Time, Event, DoorStatus, Battery

// ------------------- FETCH DATA FROM SHEET -------------------
async function fetchSheetData() {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`);
    const data = await response.json();
    if (!data.values) return;

    // Clear current events
    eventListEl.innerHTML = '';

    // Skip header row
    data.values.slice(1).reverse().forEach(row => {
      const [time, event, door, battery] = row;
      addEvent(event, time);
    });

    // Update latest door & battery
    const lastRow = data.values[data.values.length - 1];
    const lastDoor = lastRow[2] || 'UNKNOWN';
    const lastBattery = lastRow[3] || 'N/A';

    doorStatusEl.textContent = lastDoor;
    batteryLevelEl.textContent = lastBattery;

    // Update "Last Opened At" if door is OPEN
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
  const latestRows = rows.slice(-50).join('\n'); 
  downloadCSV(latestRows, 'latest_records.csv');
});

// Fetch as CSV
async function fetchSheetCSV() {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`);
    const data = await response.json();
    if (!data.values) return '';
    return data.values.map(r => r.join(',')).join('\n');
  } catch (err) {
    console.error('Error fetching sheet CSV:', err);
    return '';
  }
}

// Download helper
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ------------------- AUTO FETCH -------------------
setInterval(fetchSheetData, 5000);

// ------------------- MD BUTTON RIPPLE EFFECT -------------------
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

const darkModeSwitch = document.getElementById('darkModeSwitch');
const contrastSwitch = document.getElementById('contrastSwitch');

/* ---------- HELPER ---------- */
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

  const theme = getCurrentTheme();
  if (theme === 'dark') document.body.classList.add('contrast-dark');
  else document.body.classList.add('contrast-light');
}

/* ---------- DARK MODE ---------- */
darkModeSwitch.addEventListener('change', () => {
  const theme = darkModeSwitch.checked ? 'dark' : 'light';
  applyTheme(theme);
  applyContrastForCurrentTheme();
  localStorage.setItem('theme', theme);
});

/* ---------- HIGH CONTRAST ---------- */
contrastSwitch.addEventListener('change', () => {
  applyContrastForCurrentTheme();
  localStorage.setItem('contrast', contrastSwitch.checked ? 'on' : 'off');
});

/* ---------- RESTORE SETTINGS ON LOAD ---------- */
(function restoreSettings() {
  // Theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  darkModeSwitch.checked = savedTheme === 'dark';

  // Contrast
  if (localStorage.getItem('contrast') === 'on') {
    contrastSwitch.checked = true;
    applyContrastForCurrentTheme();
  }
})();

const reduceMotionSwitch = document.getElementById('reduceMotionSwitch');

/* ---------- DISABLE ANIMATION ---------- */
reduceMotionSwitch.addEventListener('change', () => {
  document.body.classList.toggle('no-animation', reduceMotionSwitch.checked);
  localStorage.setItem('reduceMotion', reduceMotionSwitch.checked ? 'on' : 'off');
});

/* ---------- RESTORE STATE ON LOAD ---------- */
if (localStorage.getItem('reduceMotion') === 'on') {
  document.body.classList.add('no-animation');
  reduceMotionSwitch.checked = true;
}

function updateThemeColor() {
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) return;

  if (document.body.classList.contains('dark')) {
    metaTheme.setAttribute('content', 'rgb(18 18 18)');
  } else if (document.body.classList.contains('contrast-light')) {
    metaTheme.setAttribute('content', 'rgb(255 255 255)'); 
  } else if (document.body.classList.contains('contrast-dark')) {
    metaTheme.setAttribute('content', 'rgb(0 0 0)'); 
  } else {
    metaTheme.setAttribute('content', 'rgb(235 231 231)'); 
  }
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

updateThemeColor();