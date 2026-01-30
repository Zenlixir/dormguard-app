let doorOpenTimer = null;
let doorOpenInterval = null;
let alertDisabled = false;
let alertEnabled = true;

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
const alertSwitch = document.getElementById('alertSwitch');

// Base URL for Node server
const SERVER_BASE = 'http://127.0.0.1:3000';

// ------------------- NAVIGATION -------------------
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
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

// ------------------- FETCH DATA FROM NODE SERVER -------------------
async function fetchServerData() {
  try {
    const res = await fetch(`${SERVER_BASE}/api/status`);
    const data = await res.json();

    // Update current status
    doorStatusEl.textContent = data.current.door;
    batteryLevelEl.textContent = data.current.battery + '%';

// ------------------- ALERT TOGGLE BUTTON -------------------
if (alertToggle) {
  alertToggle.addEventListener('click', async () => {
    if (doorStatusEl.textContent === 'OPEN' && alertEnabled) {
      addEvent('Alert Disabled');
      try {
        await fetch(`${SERVER_BASE}/alert?state=off`);
      } catch (err) {
        console.error('Failed to disable alert on server:', err);
      }

      alertDisabled = true; 
      if (doorOpenInterval) {
        clearInterval(doorOpenInterval);
        doorOpenInterval = null;
      }

      alertToggle.textContent = 'No Alert'; 
    }
  });
}

// ----- DOOR ALERT LOGIC -----
function handleDoorAlert() {
  if (!alertEnabled) {
    alertToggle.textContent = 'No Alert';
    doorStatusEl.style.color = '';
    if (doorOpenInterval) {
      clearInterval(doorOpenInterval);
      doorOpenInterval = null;
    }
    if (doorOpenTimer) {
      clearTimeout(doorOpenTimer);
      doorOpenTimer = null;
    }
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
          console.log('Door open detected (5 sec interval)');
        }, 5000);

        doorOpenTimer = null; 
      }, 10000); 
    }
  } else {
    
    alertToggle.textContent = 'No Alert';
    doorStatusEl.style.color = '';
    alertDisabled = false;

    if (doorOpenInterval) {
      clearInterval(doorOpenInterval);
      doorOpenInterval = null;
    }
    if (doorOpenTimer) {
      clearTimeout(doorOpenTimer);
      doorOpenTimer = null;
    }
  }
}

handleDoorAlert();

    eventListEl.innerHTML = '';
data.history.forEach(item => {
  const li = document.createElement('li');
  li.textContent = `${item.time} | ${item.date} - ${item.door}`;
  eventListEl.prepend(li);
});

    const lastOpen = data.history.find(e => e.door === 'OPEN');
    lastOpenedEl.textContent = lastOpen ? `${lastOpen.time} | ${lastOpen.date}` : '-';

  } catch (err) {
    console.error('Server not reachable', err);
  }
}

// ------------------- DATABASE BUTTONS -------------------
viewDatBtn.addEventListener('click', () => {
  window.open(`${SERVER_BASE}/view`, '_blank');
});

fullDatBtn.addEventListener('click', async () => {
  try {
    const res = await fetch(`${SERVER_BASE}/download/full`);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'full_records.csv';
    link.click();
  } catch (err) {
    console.error('Failed to download full records:', err);
  }
});

latestDatBtn.addEventListener('click', async () => {
  try {
    const res = await fetch(`${SERVER_BASE}/download/latest`);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'latest_records.csv';
    link.click();
  } catch (err) {
    console.error('Failed to download latest records:', err);
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
document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') e.preventDefault(); });
document.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));