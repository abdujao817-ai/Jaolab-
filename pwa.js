// ================= INSTALLABLE APP SUPPORT =================
(function () {
  // Head tags, added to every page
  function tag(name, attrs) {
    const el = document.createElement(name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    document.head.appendChild(el);
  }

  if (!document.querySelector("link[rel='manifest']")) tag("link", { rel: "manifest", href: "manifest.webmanifest" });
  if (!document.querySelector("meta[name='theme-color']")) tag("meta", { name: "theme-color", content: "#111111" });
  if (!document.querySelector("link[rel='apple-touch-icon']")) tag("link", { rel: "apple-touch-icon", href: "icons/icon-180.png" });
  if (!document.querySelector("link[rel='icon']")) tag("link", { rel: "icon", href: "icons/favicon-48.png" });

  // The service worker works on https and on localhost only
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // "Install the app" row on the You page
  const row = document.getElementById("install-row");
  let saved = null;

  function installed() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (row && !installed()) {
    // iPhone and iPad have no install button: show the steps instead
    if (ios) row.style.display = "flex";

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      saved = event;
      row.style.display = "flex";
    });

    row.addEventListener("click", function (event) {
      event.preventDefault();
      if (saved) {
        saved.prompt();
        saved = null;
      } else {
        alert("To install: open this site in Safari, tap the Share button, then choose Add to Home Screen.");
      }
    });
  }

  window.addEventListener("appinstalled", function () {
    if (row) row.style.display = "none";
  });
})();