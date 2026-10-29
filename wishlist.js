// ================= WISHLIST: hearts on products and the wishlist page =================
(function () {
  let wished = {};

  const style = document.createElement("style");
  style.textContent =
    ".wl-heart{position:absolute;top:6px;right:6px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);border:none;display:flex;align-items:center;justify-content:center;padding:0;z-index:2}" +
    ".wl-heart svg,.wl-btn svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".wl-heart.on svg,.wl-btn.on svg{fill:#ff6a00;stroke:#ff6a00}" +
    ".wl-btn{background:none;border:none;padding:6px;margin-right:4px;display:flex;align-items:center}" +
    ".wl-empty{grid-column:1/-1;text-align:center;color:#aaa;padding:60px 20px;line-height:1.7}" +
    ".wl-empty a{display:inline-block;margin-top:14px;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;border-radius:12px;padding:12px 22px}";
  document.head.appendChild(style);

  const HEART = "<svg viewBox='0 0 24 24'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/></svg>";

  function loggedIn() {
    return typeof Auth !== "undefined" && !!Auth.user();
  }

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function idFromHref(href) {
    return Number((href || "").split("id=")[1]);
  }

  // ---------- Data ----------
  async function loadWished() {
    wished = {};
    if (!loggedIn()) return;

    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/wishlist?select=product_id,created_at&order=created_at.desc", {
        headers: await Auth.headers()
      });
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach(function (r) {
        wished[r.product_id] = true;
      });
    } catch (e) {}
  }

  async function save(id) {
    return fetch(SUPABASE_URL + "/rest/v1/wishlist", {
      method: "POST",
      headers: await Auth.headers({
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal"
      }),
      body: JSON.stringify({ product_id: id })
    });
  }

  async function unsave(id) {
    return fetch(SUPABASE_URL + "/rest/v1/wishlist?product_id=eq." + id, {
      method: "DELETE",
      headers: await Auth.headers()
    });
  }

  // ---------- Hearts ----------
  function syncHearts() {
    document.querySelectorAll("[data-wl]").forEach(function (b) {
      b.classList.toggle("on", !!wished[b.getAttribute("data-wl")]);
    });
  }

  function decorateCards() {
    document.querySelectorAll("#product-grid .card, #cat-grid .card").forEach(function (card) {
      if (card.getAttribute("data-wl-done")) return;
      const photo = card.querySelector(".photo");
      const id = idFromHref(card.getAttribute("href"));
      if (!photo || !id) return;

      card.setAttribute("data-wl-done", "1");
      photo.style.position = "relative";
      photo.insertAdjacentHTML(
        "beforeend",
        "<button type='button' class='wl-heart" + (wished[id] ? " on" : "") + "' data-wl='" + id + "' aria-label='Save to wishlist'>" + HEART + "</button>"
      );
    });
  }

  async function toggle(id) {
    if (!loggedIn()) {
      const here = window.location.pathname.split("/").pop() + window.location.search;
      window.location.href = "login.html?next=" + encodeURIComponent(here || "index.html");
      return;
    }

    const wasOn = !!wished[id];
    wished[id] = !wasOn;
    if (wasOn) delete wished[id];
    syncHearts();

    try {
      const res = wasOn ? await unsave(id) : await save(id);
      if (!res.ok) throw new Error("failed");

      // On the wishlist page, an unsaved item leaves the list
      if (wasOn) {
        const grid = document.getElementById("wish-grid");
        if (grid) {
          const card = grid.querySelector("[data-card='" + id + "']");
          if (card) card.remove();
          if (!grid.querySelector(".card")) drawEmpty(grid);
        }
      }
    } catch (e) {
      if (wasOn) wished[id] = true;
      else delete wished[id];
      syncHearts();
      alert("Could not update your wishlist. Please try again.");
    }
  }

  document.addEventListener("click", function (event) {
    const heart = event.target.closest("[data-wl]");
    if (!heart) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(Number(heart.getAttribute("data-wl")));
  }, true);

  // ---------- Product page heart ----------
  function productPageHeart() {
    if (!document.getElementById("buy-once")) return;
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    const cart = document.querySelector(".topcart");
    if (!id || !cart) return;

    cart.insertAdjacentHTML(
      "beforebegin",
      "<button type='button' class='wl-btn' data-wl='" + id + "' aria-label='Save to wishlist' style='margin-left:auto'>" + HEART + "</button>"
    );
    cart.style.marginLeft = "0";
  }

  // ---------- Wishlist page ----------
  function drawEmpty(grid) {
    grid.innerHTML =
      "<div class='wl-empty'>Your wishlist is empty.<br>Tap the heart on any product to save it here.<br>" +
      "<a href='index.html'>Start shopping</a></div>";
  }

  function drawWishlistPage() {
    const grid = document.getElementById("wish-grid");
    if (!grid) return;

    if (!loggedIn()) {
      window.location.replace("login.html?next=wishlist.html");
      return;
    }

    const list = products.filter(function (p) {
      return wished[p.id];
    });

    if (list.length === 0) {
      drawEmpty(grid);
      return;
    }

    grid.innerHTML = list.map(function (p) {
      return (
        "<a href='product.html?id=" + p.id + "' class='card' data-card='" + p.id + "'>" +
        "<div class='photo' style=\"position:relative;" + photoStyle(p) + "\">" +
        "<button type='button' class='wl-heart on' data-wl='" + p.id + "' aria-label='Remove from wishlist'>" + HEART + "</button></div>" +
        "<p class='name'>" + esc(p.name) + "</p>" +
        "<p class='price'>" + formatPrice(p.price) + "</p></a>"
      );
    }).join("");
  }

  // ---------- Start ----------
  loadWished().then(function () {
    decorateCards();
    productPageHeart();
    syncHearts();
    drawWishlistPage();

    // Cards drawn later (tabs, search, filters, load more) get hearts too
    ["product-grid", "cat-grid"].forEach(function (id) {
      const grid = document.getElementById(id);
      if (!grid) return;
      new MutationObserver(decorateCards).observe(grid, { childList: true });
    });
  });
})();