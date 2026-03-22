document.addEventListener("DOMContentLoaded", () => {

  const stpPages = document.querySelector(".stp-pages");
  const dots = document.querySelectorAll(".stp-dot");

  const enc = (str) => btoa(unescape(encodeURIComponent(str)));
  const dec = (str) => { try { return decodeURIComponent(escape(atob(str))); } catch { return str; } };
  const getUrl = (key) => { const v = localStorage.getItem(key); if (!v) return ''; try { atob(v); return dec(v); } catch { return v; } };
  const setUrl = (key, val) => localStorage.setItem(key, enc(val));

  const haptic = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

  if (stpPages && dots.length) {
    const totalPages = dots.length;

    const updateDots = () => {
      const index = Math.round(stpPages.scrollLeft / stpPages.clientWidth);
      dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    };

    stpPages.addEventListener("scroll", updateDots);
    window.addEventListener("resize", updateDots);

    const scrollToPage = (index) => {
      stpPages.scrollTo({ left: stpPages.clientWidth * index, behavior: "smooth" });
    };

    const nextPage = () => {
      const current = Math.round(stpPages.scrollLeft / stpPages.clientWidth);
      scrollToPage((current + 1) % totalPages);
    };

    const firstPage = document.querySelector(".stp-page");
    if (firstPage) {
      const mainCard = firstPage.querySelector(".stp-alone .stp-card");
      const gridCards = firstPage.querySelectorAll(".stp-grid .stp-card");

      if (mainCard)     mainCard.addEventListener("click", () => scrollToPage(1));
      if (gridCards[0]) gridCards[0].addEventListener("click", () => scrollToPage(2));
      if (gridCards[1]) gridCards[1].addEventListener("click", () => scrollToPage(3));
    }

    document.querySelectorAll(".stp-next").forEach(btn => {
      btn.addEventListener("click", nextPage);
    });
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';

  function scrambleDecode(textarea, finalText, duration = 1500, delay = 300, onDone) {
    let cancelled = false;
    const cancel = () => { cancelled = true; };

    setTimeout(() => {
      if (cancelled) return;
      textarea.classList.add('decoding');

      const hapticInterval = setInterval(() => {
        if (cancelled) { clearInterval(hapticInterval); return; }
        haptic([22, 20]);
      }, 90);

      const len = finalText.length;
      const start = Date.now();
      const resolved = new Array(len).fill(false);

      const frame = () => {
        if (cancelled) {
          clearInterval(hapticInterval);
          textarea.value = finalText;
          textarea.classList.remove('decoding');
          if (onDone) onDone();
          return;
        }

        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const resolveCount = Math.floor(progress * len);

        for (let i = 0; i < resolveCount; i++) resolved[i] = true;

        let display = '';
        for (let i = 0; i < len; i++) {
          if (resolved[i]) {
            display += finalText[i];
          } else {
            display += chars[Math.floor(Math.random() * chars.length)];
          }
        }

        textarea.value = display;

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          textarea.value = finalText;
          textarea.classList.remove('decoding');
          clearInterval(hapticInterval);
          if (onDone) onDone();
        }
      };

      requestAnimationFrame(frame);
    }, delay);

    return cancel;
  }

  let toastQueue = [];
  let toastRunning = false;

  function showToast(icon, message) {
    toastQueue.push({ icon, message });
    if (!toastRunning) runToastQueue();
  }

  function runToastQueue() {
    if (!toastQueue.length) { toastRunning = false; return; }
    toastRunning = true;
    const { icon, message } = toastQueue.shift();

    haptic(30);

    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("show"));
    });

    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => {
        toast.remove();
        runToastQueue();
      }, { once: true });
    }, 2500);
  }

  document.querySelectorAll(".md-input, .md-input2").forEach(textarea => {
    const page = textarea.closest(".stp-page");
    if (!page) return;

    textarea.dataset.origPlaceholder = textarea.getAttribute("placeholder") || "";

    if (textarea.id === 'doorApiInput') {
      const saved = getUrl('api_url');
      if (saved) {
        textarea.dataset.realValue = saved;
        textarea.value = '';
        textarea.setAttribute('placeholder', 'Edit?');
        textarea.classList.add('stp-has-value');
      }
    } else if (textarea.classList.contains('md-input2')) {
      const saved = getUrl('sheets_url');
      if (saved) {
        textarea.dataset.realValue = saved;
        textarea.value = '';
        textarea.setAttribute('placeholder', 'Edit?');
        textarea.classList.add('stp-has-value');
      }
    } else if (textarea.id === 'ctrlsApiInput') {
      const saved = getUrl('ctrls_url');
      if (saved) {
        textarea.dataset.realValue = saved;
        textarea.value = '';
        textarea.setAttribute('placeholder', 'Edit?');
        textarea.classList.add('stp-has-value');
      }
    }

    const updateMask = (ta) => {
      const hasVal = (ta.dataset.realValue || ta.value).trim().length > 0;
      ta.classList.toggle("stp-has-value", hasVal);
    };

    const doneBtn = document.createElement("button");
    doneBtn.className = "stp-done-btn md-btn";
    doneBtn.innerHTML = `<span class="material-symbols-outlined">check</span>`;
    doneBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      textarea.blur();
    });

    let expandTimer   = null;
    let collapseTimer = null;
    let cancelDecode  = null;

    const expand = () => {
      clearTimeout(collapseTimer);
      clearTimeout(expandTimer);
      if (cancelDecode) { cancelDecode(); cancelDecode = null; }

      const savedValue = textarea.dataset.realValue;
      if (savedValue !== undefined) {
        textarea.value = '';
        delete textarea.dataset.realValue;
      }

      textarea.setAttribute("placeholder", textarea.dataset.origPlaceholder);
      textarea.classList.remove("stp-has-value");

      if (!page.contains(doneBtn)) page.appendChild(doneBtn);

      haptic([30, 80, 30, 80, 30]);

      expandTimer = setTimeout(() => {
        page.classList.add("stp-expanded");
        textarea.classList.add("stp-textarea-active");
        if (stpPages) stpPages.style.overflowX = "hidden";
        requestAnimationFrame(() => doneBtn.classList.add("show"));

        if (savedValue) {
          cancelDecode = scrambleDecode(textarea, savedValue, 1500, 300, () => {
            cancelDecode = null;
            showToast('lock_open', 'Decrypted');
          });
        }
      }, 300);
    };

    const collapse = () => {
      clearTimeout(expandTimer);
      if (cancelDecode) { cancelDecode(); cancelDecode = null; }

      doneBtn.classList.remove("show");
      doneBtn.addEventListener("transitionend", () => {
        if (doneBtn.parentNode) doneBtn.remove();
      }, { once: true });

      collapseTimer = setTimeout(() => {
        page.classList.remove("stp-expanded");
        textarea.classList.remove("stp-textarea-active");
        if (stpPages) stpPages.style.overflowX = "auto";
        if (textarea.value.trim().length > 0) {
          textarea.dataset.realValue = textarea.value;
          textarea.value = "";
          textarea.setAttribute("placeholder", "Edit?");
          textarea.classList.add("stp-has-value");
          haptic([30, 40, 30, 40, 30]);
          showToast('lock', 'Encrypted');
        } else {
          haptic(30);
        }
      }, 300);
    };

    textarea.addEventListener("focus", expand);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); textarea.blur(); }
    });
    textarea.addEventListener("blur", collapse);
    textarea.addEventListener("input", () => updateMask(textarea));
    updateMask(textarea);
  });

  const doorApiInput   = document.getElementById("doorApiInput");
  const sheetsInput    = document.querySelector(".md-input2");
  const ctrlsApiInput  = document.getElementById("ctrlsApiInput");
  const saveConfigBtn  = document.getElementById("saveConfig");
  const resetConfigBtn = document.getElementById("resetConfig");

  sheetsInput?.addEventListener("input", () => {
    const url = sheetsInput.value.trim();
    if (url) setUrl("sheets_url", url);
  });

  function showResetConfirm(onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "md-dialog-overlay";

    overlay.innerHTML = `
      <div class="md-dialog">
        <span class="material-symbols-outlined md-dialog-icon">warning</span>
        <div class="md-dialog-title">Reset Config?</div>
        <div class="md-dialog-body">All saved URLs will be cleared. This cannot be undone.</div>
        <div class="md-dialog-actions">
          <button class="md-dialog-btn cancel">Nope</button>
          <button class="md-dialog-btn confirm">Reset</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("show"));
    });

    const close = () => {
      overlay.classList.remove("show");
      overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
    };

    overlay.querySelector(".cancel").addEventListener("click", close);
    overlay.querySelector(".confirm").addEventListener("click", () => {
      close();
      onConfirm();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  saveConfigBtn?.addEventListener("click", () => {
    const doorUrl = (doorApiInput?.dataset.realValue || doorApiInput?.value || "").trim();
    if (doorUrl.startsWith("http")) {
      window.API_KEY = doorUrl.replace(/\/$/, "");
      setUrl("api_url", window.API_KEY);
    }

    const sheetsUrl = (sheetsInput?.dataset.realValue || sheetsInput?.value || "").trim();
    if (sheetsUrl.startsWith("http")) {
      setUrl("sheets_url", sheetsUrl);
    }

    const ctrlsUrl = (ctrlsApiInput?.dataset.realValue || ctrlsApiInput?.value || "").trim();
    if (ctrlsUrl.startsWith("http")) {
      setUrl("ctrls_url", ctrlsUrl);
    }

    if (navigator.vibrate) navigator.vibrate(30);
    showToast("check_circle", "Config saved");
  });

  resetConfigBtn?.addEventListener("click", () => {
    showResetConfirm(() => {
      [doorApiInput, sheetsInput, ctrlsApiInput].forEach(ta => {
        if (!ta) return;
        ta.value = "";
        delete ta.dataset.realValue;
        ta.classList.remove("stp-has-value");
        ta.setAttribute("placeholder", ta.dataset.origPlaceholder || "");
      });

      localStorage.removeItem("api_url");
      localStorage.removeItem("sheets_url");
      localStorage.removeItem("ctrls_url");

      window.API_KEY = "";
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      showToast("restart_alt", "Config reset");

      if (stpPages) stpPages.scrollTo({ left: 0, behavior: "smooth" });
    });
  });

});