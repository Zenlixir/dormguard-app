document.addEventListener('DOMContentLoaded', () => {
  const ctrlsApiInput = document.getElementById('ctrlsApiInput');
  const getUrl = (key) => { const v = localStorage.getItem(key); if (!v) return ''; try { atob(v); return decodeURIComponent(escape(atob(v))); } catch { return v; } };

  let sheetAPI = getUrl('ctrls_url');
  if (ctrlsApiInput) {
    ctrlsApiInput.addEventListener('change', () => {
      sheetAPI = ctrlsApiInput.value.trim();
    });
  }

  const ledSwitch       = document.getElementById('ledSwitch');
  const buzzerSwitch    = document.getElementById('buzzerSwitch');
  const vibrationSwitch = document.getElementById('vibrationSwitch');
  const lampSwitch      = document.getElementById('lampSwitch');
  const alertToggle     = document.getElementById('alertToggle');
  const alertSwitch     = document.getElementById('alertSwitch');
  const doorStatusEl    = document.getElementById('doorStatus');

  if (ledSwitch)       ledSwitch.checked      = localStorage.getItem('ledState')       === '1';
  if (buzzerSwitch)    buzzerSwitch.checked    = localStorage.getItem('buzzerState')    === '1';
  if (vibrationSwitch) vibrationSwitch.checked = localStorage.getItem('vibrationState') === '1';
  if (lampSwitch)      lampSwitch.checked      = localStorage.getItem('lampState')      === '1';

  async function updateSheet(led = 0, buzzer = 0, stop = 0, lamp = 0, alert = null) {
    if (!sheetAPI) return;
    let url = `${sheetAPI}?led=${led}&buzzer=${buzzer}&stop=${stop}&lamp=${lamp}`;
    if (alert !== null) url += `&alert=${alert}`;
    try {
      await fetch(url);
    } catch (err) {}
  }

  const ledVal    = () => ledSwitch    ? (ledSwitch.checked    ? 1 : 0) : 0;
  const buzzerVal = () => buzzerSwitch ? (buzzerSwitch.checked ? 1 : 0) : 0;
  const lampVal   = () => lampSwitch   ? (lampSwitch.checked   ? 1 : 0) : 0;

  if (ledSwitch) {
    ledSwitch.addEventListener('change', () => {
      localStorage.setItem('ledState', ledSwitch.checked ? '1' : '0');
      updateSheet(ledVal(), buzzerVal(), 0, lampVal());
    });
  }

  if (buzzerSwitch) {
    buzzerSwitch.addEventListener('change', () => {
      localStorage.setItem('buzzerState', buzzerSwitch.checked ? '1' : '0');
      updateSheet(ledVal(), buzzerVal(), 0, lampVal());
    });
  }

  if (vibrationSwitch) {
    vibrationSwitch.addEventListener('change', () => {
      localStorage.setItem('vibrationState', vibrationSwitch.checked ? '1' : '0');
      if (navigator.vibrate) navigator.vibrate(50);
    });
  }

  if (lampSwitch) {
    lampSwitch.addEventListener('change', () => {
      localStorage.setItem('lampState', lampSwitch.checked ? '1' : '0');
      updateSheet(ledVal(), buzzerVal(), 0, lampVal());
    });
  }

  let alertCooldown = false;

  function resetAlert() {
    if (alertToggle) alertToggle.textContent = 'No Alert';
    if (doorStatusEl) doorStatusEl.style.color = '';
    if (typeof doorOpenInterval !== 'undefined' && doorOpenInterval) {
      clearInterval(doorOpenInterval);
      doorOpenInterval = null;
    }
    if (typeof doorOpenTimer !== 'undefined' && doorOpenTimer) {
      clearTimeout(doorOpenTimer);
      doorOpenTimer = null;
    }
  }

  if (alertToggle) {
    alertToggle.addEventListener('click', () => {
      resetAlert();
      alertCooldown = true;
      setTimeout(() => { alertCooldown = false; }, 10000);
      updateSheet(ledVal(), buzzerVal(), 1, lampVal());
      setTimeout(() => updateSheet(ledVal(), buzzerVal(), 0, lampVal()), 4000);
    });
  }

  let lastKnownDoor = '';
  setInterval(() => {
    if (!doorStatusEl) return;
    const current = doorStatusEl.textContent;
    if (current !== lastKnownDoor) {
      lastKnownDoor = current;
      if (current === 'CLOSED') {
        resetAlert();
        alertCooldown = false;
      }
    }
  }, 300);

  async function syncEspAlert() {
    if (!sheetAPI) return;
    try {
      const res = await fetch(sheetAPI);
      const data = await res.json();
      const espAlert = data.alert;

      const alertEnabled = localStorage.getItem('alert') === 'on';
      if (!alertEnabled) return;

      if (espAlert == 1 && !alertCooldown) {
        if (alertToggle) alertToggle.textContent = 'Disable Alert';
        if (doorStatusEl) doorStatusEl.style.color = 'red';
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
      } else if (espAlert == 0) {
        resetAlert();
      }
    } catch (err) {}
  }

  setInterval(syncEspAlert, 2000);
  syncEspAlert();

  updateSheet(ledVal(), buzzerVal(), 0, lampVal(), 0);
});