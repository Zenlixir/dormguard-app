const CHECK_INTERVAL = 5000;
const getUrl = (key) => { const v = localStorage.getItem(key); if (!v) return ''; try { atob(v); return decodeURIComponent(escape(atob(v))); } catch { return v; } };

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

console.log('isCapacitor:', isCapacitor);
console.log('Capacitor plugins:', JSON.stringify(Object.keys(window.Capacitor?.Plugins || {})));

async function checkDoorNotif() {
  if (!notifEnabled) return;
  const CTRLS_URL = getUrl('ctrls_url');
  if (!CTRLS_URL) return;

  try {
    const res = await fetch(CTRLS_URL);
    const data = await res.json();

    console.log('ctrls data:', JSON.stringify(data));

    if (data.alert === 1 && !notifSent) {
      await notify();
      notifSent = true;
    } else if (data.alert === 0) {
      notifSent = false;
    }
  } catch(e) {
    console.log('checkDoorNotif error:', e);
  }
}

async function notify() {
  navigator.vibrate?.([200, 100, 200]);
  console.log('notify() called, isCapacitor:', isCapacitor);

  if (isCapacitor) {
    const { LocalNotifications } = window.Capacitor?.Plugins || {};
    console.log('LocalNotifications:', LocalNotifications);
    if (!LocalNotifications) return;
    try {
      const perm = await LocalNotifications.requestPermissions();
      console.log('permission:', JSON.stringify(perm));
      await LocalNotifications.schedule({
        notifications: [{
          title: 'DormGuard Alert',
          body: 'Door has been open for more than 3 minutes!',
          id: 1,
          smallIcon: 'ic_notif',
          actionTypeId: '',
          extra: null
        }]
      });
      console.log('notification scheduled');
    } catch(e) {
      console.log('LocalNotifications error:', e);
    }
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