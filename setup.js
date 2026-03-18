
document.addEventListener("DOMContentLoaded", () => {

  const stpPages = document.querySelector(".stp-pages");
  const dots = document.querySelectorAll(".stp-dot");

  if (stpPages && dots.length) {
    const updateDots = () => {
      const index = Math.round(stpPages.scrollLeft / stpPages.clientWidth);
      dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    };

    stpPages.addEventListener("scroll", updateDots);
    window.addEventListener("resize", updateDots);

    const scrollToPage = (index) => {
      stpPages.scrollTo({ left: stpPages.clientWidth * index, behavior: "smooth" });
    };

    const firstPage = document.querySelector(".stp-page");
    if (firstPage) {
      const mainCard = firstPage.querySelector(".stp-alone .stp-card");
      const gridCards = firstPage.querySelectorAll(".stp-grid .stp-card");

      if (mainCard)     mainCard.addEventListener("click", () => scrollToPage(1));
      if (gridCards[0]) gridCards[0].addEventListener("click", () => scrollToPage(2));
      if (gridCards[1]) gridCards[1].addEventListener("click", () => scrollToPage(3));
    }
  }

  const doorApiInput  = document.getElementById("doorApiInput");
  const sheetsInput   = document.querySelector(".md-input2");
  const ctrlsApiInput = document.getElementById("ctrlsApiInput");
  const saveConfigBtn  = document.getElementById("saveConfig");
  const resetConfigBtn = document.getElementById("resetConfig");

  if (doorApiInput)  doorApiInput.value  = localStorage.getItem("api_url")    || "";
  if (sheetsInput)   sheetsInput.value   = localStorage.getItem("sheets_url") || "";
  if (ctrlsApiInput) ctrlsApiInput.value = localStorage.getItem("ctrls_url")  || "";

  sheetsInput?.addEventListener("input", () => {
    const url = sheetsInput.value.trim();
    if (url) localStorage.setItem("sheets_url", url);
  });

  // toast
  function showToast(icon, message) {
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
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 2500);
  }

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
    const doorUrl = doorApiInput?.value.trim();
    if (doorUrl?.startsWith("http")) {
      window.API_KEY = doorUrl.replace(/\/$/, "");
      localStorage.setItem("api_url", window.API_KEY);
    }

    const sheetsUrl = sheetsInput?.value.trim();
    if (sheetsUrl?.startsWith("http")) {
      localStorage.setItem("sheets_url", sheetsUrl);
    }

    const ctrlsUrl = ctrlsApiInput?.value.trim();
    if (ctrlsUrl?.startsWith("http")) {
      localStorage.setItem("ctrls_url", ctrlsUrl);
    }

    if (navigator.vibrate) navigator.vibrate(30);
    showToast("check_circle", "Config saved");
  });

  resetConfigBtn?.addEventListener("click", () => {
    showResetConfirm(() => {
      if (doorApiInput)  doorApiInput.value  = "";
      if (sheetsInput)   sheetsInput.value   = "";
      if (ctrlsApiInput) ctrlsApiInput.value = "";

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