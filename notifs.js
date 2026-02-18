// ========== CONFIG ==========
const CHECK_INTERVAL = 5000;
const LIMIT = 3 * 60 * 1000; // 3 minutes

// ========== STATE ==========
let notifSent = false;

// ========== NOTIFICATION TOGGLE ==========
const notifSwitch = document.getElementById('notificationsSwitch');
let notifEnabled = localStorage.getItem('notifEnabled') === 'true';

if (notifSwitch) {
  notifSwitch.checked = notifEnabled;

  notifSwitch.addEventListener('change', () => {
    notifEnabled = notifSwitch.checked;
    localStorage.setItem('notifEnabled', notifEnabled);
  });
}

// ========== CORE ==========
async function checkDoorNotif() {
  if (!notifEnabled) return; // skip wen notifications disabled

  const API_URL = localStorage.getItem('api_url') || "";
  if (!API_URL) return;

  try {
    const res = await fetch(API_URL);
    const raw = await res.json();
    const rows = raw.values || raw || [];
    if (!rows.length) return;

    const lastOpen = [...rows].reverse().find(r => {
      const door = r.door || r[2];
      return door === "OPEN";
    });
    if (!lastOpen) return;

    const rawTime = lastOpen.time || lastOpen[0];
    const rawDate = lastOpen.date || lastOpen[1];

    const date = new Date(rawDate);
    const time = new Date(rawTime);

    const lastOpened = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds()
    ).getTime();
    if (isNaN(lastOpened)) return;

    const diff = Date.now() - lastOpened;

    if (diff >= LIMIT && !notifSent) {
      notify();
      notifSent = true;
    } else if (diff < LIMIT) {
      notifSent = false;
    }

  } catch {
  }
}

// ========== NOTIFICATION ==========
function notify() {
  if (Notification.permission !== "granted") return;

  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;

    reg.showNotification("DormGuard Alert", {
      body: "Door open > 3 minutes",
      icon: "empty.png",
      badge: "badge.png",
      vibrate: [200, 100, 200],
      tag: "door-alert",
      renotify: true
    });
  });
}

// ========== PERMISSION ==========
if ('Notification' in window && Notification.permission === "default") {
  Notification.requestPermission();
}

// ========== LOOP ==========
setInterval(checkDoorNotif, CHECK_INTERVAL);
checkDoorNotif();