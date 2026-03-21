const CHECK_INTERVAL = 5000;

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

if (!isCapacitor && 'Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

async function checkDoorNotif() {
  if (!notifEnabled) return;
  const CTRLS_URL = localStorage.getItem('ctrls_url') || '';
  if (!CTRLS_URL) return;

  try {
    const res = await fetch(CTRLS_URL);
    const data = await res.json();

    if (data.alert === 1 && !notifSent) {
      await notify();
      notifSent = true;
    } else if (data.alert === 0) {
      notifSent = false;
    }
  } catch {}
}

async function notify() {
  navigator.vibrate?.([200, 100, 200]);

  if (isCapacitor) {
    const { LocalNotifications } = window.Capacitor?.Plugins || {};
    if (!LocalNotifications) return;
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [{
        title: 'DormGuard Alert',
        body: 'Door has been open for more than 3 minutes!',
        id: 1,
        smallIcon: 'ic_launcher_foreground',
        actionTypeId: '',
        extra: null
      }]
    });
    return;
  }

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
        icon: 'icon.png'
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