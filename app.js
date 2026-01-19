const pages = document.querySelectorAll('.page');
const buttons = document.querySelectorAll('.nav-item');
const mdButtons = document.querySelectorAll('.md-btn');

const doorStatusEl = document.getElementById('doorStatus');
const batteryLevelEl = document.getElementById('batteryLevel');
const eventListEl = document.getElementById('eventList');

const activeBtn = document.getElementById('activeBtn');
const nonactiveBtn = document.getElementById('nonactiveBtn');

let active = false;

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.page).classList.add('active');
  });
});

activeBtn.addEventListener('click', () => { active = true; addEvent('Dorm Guard turned on'); });
nonactiveBtn.addEventListener('click', () => { active = false; addEvent('Dorm Guard turned off'); });

// Logs
function addEvent(text) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  eventListEl.prepend(li);
}

setInterval(() => {
  doorStatusEl.textContent = Math.random() > 0.5 ? 'OPEN' : 'CLOSED';
  batteryLevelEl.textContent = `${Math.floor(70 + Math.random()*30)}%`;
  if(active && Math.random() > 0.7) addEvent('Door opened');
}, 5000);

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