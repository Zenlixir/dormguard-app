const CHECK_INTERVAL = 5000;
const LIMIT = 3 * 60 * 1000;

let notifSent = false;

const notifSwitch = document.getElementById('notificationsSwitch');
let notifEnabled = localStorage.getItem('notifEnabled') === 'true';

if (notifSwitch) {
  notifSwitch.checked = notifEnabled;
  notifSwitch.addEventListener('change', () => {
    notifEnabled = notifSwitch.checked;
    localStorage.setItem('notifEnabled', notifEnabled);
  });
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

async function checkDoorNotif() {
  if (!notifEnabled) return;
  const API_URL = localStorage.getItem('api_url') || '';
  if (!API_URL) return;

  try {
    const res = await fetch(API_URL);
    const raw = await res.json();
    const rows = raw.values || raw || [];
    if (!rows.length) return;

    const lastOpen = [...rows].reverse().find(r => (r.door || r[2]) === 'OPEN');
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
      await notify();
      notifSent = true;
    } else if (diff < LIMIT) {
      notifSent = false;
    }
  } catch {}
}

async function notify() {
  navigator.vibrate?.([200, 100, 200]);
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification('DormGuard Alert', {
        body: 'Door has been open for more than 3 minutes!',
        icon: 'icon.png',
        badge: 'badge.png',
        vibrate: [200, 100, 200],
        tag: 'door-alert',
        renotify: true
      });
    } else {
      new Notification('DormGuard Alert', {
        body: 'Door has been open for more than 3 minutes!',
        icon: 'icon.png',
        badge: 'badge.png'
      });
    }
  } catch {
    new Notification('DormGuard Alert', {
      body: 'Door has been open for more than 3 minutes!',
      icon: 'icon.png'
    });
  }
}

setInterval(checkDoorNotif, CHECK_INTERVAL);
checkDoorNotif();