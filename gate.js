// ================= GUEST GATE: browse freely, log in to buy =================
(function () {
  if (typeof Auth === "undefined") return;

  const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const here = page + window.location.search;
  const PROTECTED = ["cart.html", "checkout.html", "orders.html"];

  function loginUrl(mode) {
    return "login.html?next=" + encodeURIComponent(here) + (mode ? "&mode=" + mode : "");
  }

  // 1. Pages that need an account: send guests to the login page
  if (PROTECTED.indexOf(page) !== -1) {
    Auth.token().then(function (token) {
      if (!token) {
        window.location.replace(loginUrl());
      }
    });
    return;
  }

  // 2. Everywhere else guests can look around, but not buy
  const style = document.createElement("style");
  style.textContent =
    ".gate-back{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:24px;z-index:100}" +
    ".gate-back.show{display:flex}" +
    ".gate-box{background:#1f1f1f;border-radius:20px;padding:24px 20px;max-width:380px;width:100%;text-align:center}" +
    ".gate-ico{width:56px;height:56px;border-radius:50%;background:#2a1a0a;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}" +
    ".gate-ico svg{width:26px;height:26px;fill:none;stroke:#ff6a00;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".gate-box h3{font-size:20px;margin-bottom:8px}" +
    ".gate-box p{color:#bbb;font-size:14px;line-height:1.6;margin-bottom:18px}" +
    ".gate-btn{display:block;width:100%;border:none;border-radius:26px;padding:14px;font-size:16px;font-weight:bold;text-decoration:none;margin-bottom:10px}" +
    ".gate-main{background:#ff6a00;color:#fff}" +
    ".gate-alt{background:none;border:1px solid #ff6a00 !important;color:#ff6a00}" +
    ".gate-skip{background:none;border:none;color:#aaa;font-size:14px;padding:8px}" +
    ".gate-note{background:#222;border-left:4px solid #ff6a00;border-radius:10px;padding:10px 12px;margin:12px 0 0;font-size:13px;color:#ccc;line-height:1.5}" +
    ".gate-note a{color:#ff6a00;font-weight:bold;text-decoration:none}";
  document.head.appendChild(style);

  const back = document.createElement("div");
  back.className = "gate-back";
  back.innerHTML =
    "<div class='gate-box'>" +
    "<div class='gate-ico'><svg viewBox='0 0 24 24'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg></div>" +
    "<h3>Log in to continue</h3>" +
    "<p>Create a free account or log in to buy, pay in installments and track your orders. You can keep browsing as a guest.</p>" +
    "<a class='gate-btn gate-main' id='gate-login' href='#'>Log in</a>" +
    "<a class='gate-btn gate-alt' id='gate-signup' href='#'>Create an account</a>" +
    "<button class='gate-skip' id='gate-skip'>Keep browsing</button>" +
    "</div>";
  document.body.appendChild(back);

  document.getElementById("gate-login").href = loginUrl();
  document.getElementById("gate-signup").href = loginUrl("signup");

  function closeModal() {
    back.classList.remove("show");
  }

  document.getElementById("gate-skip").onclick = closeModal;
  back.addEventListener("click", function (event) {
    if (event.target === back) closeModal();
  });

  // Stop guests before the shop's own buttons run
  document.addEventListener("click", function (event) {
    const target = event.target.closest("#buy-once, #add-cart, #start-plan");
    if (!target || Auth.user()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    back.classList.add("show");
  }, true);

  // A short note on the product page
  const addButton = document.getElementById("add-cart");
  if (addButton && !Auth.user()) {
    const note = document.createElement("div");
    note.className = "gate-note";
    note.innerHTML =
      "You are browsing as a guest. <a href='" + loginUrl() + "'>Log in</a> or " +
      "<a href='" + loginUrl("signup") + "'>create an account</a> to buy.";
    addButton.parentNode.insertBefore(note, addButton);
  }
})();