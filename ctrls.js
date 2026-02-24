document.addEventListener('DOMContentLoaded', () => {
  const ctrlsApiInput = document.getElementById('ctrlsApiInput');

  // ---------- CONFIG ----------
  let sheetAPI = localStorage.getItem('ctrls_api') || "";
  if (ctrlsApiInput) {
    ctrlsApiInput.value = sheetAPI;
    ctrlsApiInput.addEventListener('change', () => {
      sheetAPI = ctrlsApiInput.value.trim();
      localStorage.setItem('ctrls_api', sheetAPI);
      console.log("Controls API updated:", sheetAPI);
    });
  }

  // ---------- ELEMENTS ----------
  const ledSwitch = document.getElementById('ledSwitch');
  const buzzerSwitch = document.getElementById('buzzerSwitch');
  const vibrationSwitch = document.getElementById('vibrationSwitch');
  const alertToggle = document.getElementById('alertToggle');

  // ---------- INITIAL STATE FROM LOCAL STORAGE ----------
  if (ledSwitch) ledSwitch.checked = localStorage.getItem('ledState') === '1';
  if (buzzerSwitch) buzzerSwitch.checked = localStorage.getItem('buzzerState') === '1';
  if (vibrationSwitch) vibrationSwitch.checked = localStorage.getItem('vibrationState') === '1';

  // ---------- HELPER ----------
  async function updateSheet(led = 0, buzzer = 0, stop = 0) {
    if (!sheetAPI) {
      console.warn("Controls API not set!");
      return;
    }
    const url = `${sheetAPI}?led=${led}&buzzer=${buzzer}&stop=${stop}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log("Sheet updated:", text);
    } catch (err) {
      console.error("Failed to update sheet:", err);
    }
  }

  // ---------- TOGGLES ----------
  if (ledSwitch) {
    ledSwitch.addEventListener('change', () => {
      localStorage.setItem('ledState', ledSwitch.checked ? '1' : '0');
      updateSheet(ledSwitch.checked ? 1 : 0, buzzerSwitch.checked ? 1 : 0, 0);
    });
  }

  if (buzzerSwitch) {
    buzzerSwitch.addEventListener('change', () => {
      localStorage.setItem('buzzerState', buzzerSwitch.checked ? '1' : '0');
      updateSheet(ledSwitch.checked ? 1 : 0, buzzerSwitch.checked ? 1 : 0, 0);
    });
  }

  if (vibrationSwitch) {
    vibrationSwitch.addEventListener('change', () => {
      localStorage.setItem('vibrationState', vibrationSwitch.checked ? '1' : '0');
      if (navigator.vibrate) navigator.vibrate(50);
    });
  }

  // ---------- STOP ALERT ----------
  if (alertToggle) {
    alertToggle.addEventListener('click', () => {
      alertToggle.textContent = 'No Alert';
      if (doorStatusEl) doorStatusEl.style.color = '';
      if (doorOpenInterval) { clearInterval(doorOpenInterval); doorOpenInterval = null; }
      if (doorOpenTimer) { clearTimeout(doorOpenTimer); doorOpenTimer = null; }

      updateSheet(ledSwitch.checked ? 1 : 0, buzzerSwitch.checked ? 1 : 0, 1);
      setTimeout(() => updateSheet(ledSwitch.checked ? 1 : 0, buzzerSwitch.checked ? 1 : 0, 0), 1000);
    });
  }

  // ---------- INIT ----------
  updateSheet(ledSwitch.checked ? 1 : 0, buzzerSwitch.checked ? 1 : 0, 0); 
});