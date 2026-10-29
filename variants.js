// ================= PRODUCT OPTIONS: gallery, sizes, colors, description =================
(function () {
  const style = document.createElement("style");
  style.textContent =
    ".pv-count{position:absolute;right:10px;bottom:10px;background:rgba(0,0,0,.65);color:#fff;font-size:13px;border-radius:12px;padding:3px 10px}" +
    ".pv-thumbs{display:flex;gap:8px;overflow-x:auto;padding:10px 12px 0}" +
    ".pv-thumb{width:58px;height:58px;flex-shrink:0;border-radius:8px;border:2px solid transparent;background:#fff center/contain no-repeat;padding:0}" +
    ".pv-thumb.on{border-color:#ff6a00}" +
    ".opt-box{margin:4px 0 14px}" +
    ".opt-title{font-size:15px;font-weight:bold;margin:10px 0 8px}" +
    ".opt-chips{display:flex;flex-wrap:wrap;gap:8px}" +
    ".opt-chip{min-width:48px;background:none;color:#fff;border:1px solid #555;border-radius:10px;padding:9px 14px;font-size:15px}" +
    ".opt-chip.on{background:#ff6a00;border-color:#ff6a00;font-weight:bold}" +
    ".pv-desc{line-height:1.6;color:#ddd;font-size:15px}";
  document.head.appendChild(style);

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function asList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function cssUrl(url) {
    return "url('" + String(url).replace(/'/g, "%27").replace(/"/g, "%22") + "')";
  }

  window.selectedOptions = { size: "", color: "" };

  // ---------- The cart now keeps size and color, and keeps different options apart ----------
  if (typeof addToCart === "function") {
    addToCart = function (item) {
      const opts = window.selectedOptions || {};
      if (item.size === undefined && opts.size) item.size = opts.size;
      if (item.color === undefined && opts.color) item.color = opts.color;

      function same(a, b) {
        return (a || "") === (b || "");
      }

      const cart = getCart();

      if (item.mode === "once") {
        for (let i = 0; i < cart.length; i++) {
          const c = cart[i];
          if (c.id === item.id && c.mode === "once" && same(c.size, item.size) && same(c.color, item.color)) {
            c.qty += 1;
            saveCart(cart);
            return;
          }
        }
      }

      cart.push(item);
      saveCart(cart);
    };
  }

  // ---------- Product page ----------
  const buyButton = document.getElementById("buy-once");
  const bigPhoto = document.querySelector(".big-photo");

  if (buyButton && bigPhoto) {
    const productId = Number(new URLSearchParams(window.location.search).get("id"));
    const product = findProduct(productId);

    if (product) {
      // Photo gallery
      const photos = [product.image_url].concat(asList(product.images)).filter(Boolean);

      if (photos.length > 1) {
        let index = 0;
        bigPhoto.style.position = "relative";

        const counter = document.createElement("span");
        counter.className = "pv-count";
        bigPhoto.appendChild(counter);

        const strip = document.createElement("div");
        strip.className = "pv-thumbs";
        bigPhoto.insertAdjacentElement("afterend", strip);

        const show = function (i) {
          index = (i + photos.length) % photos.length;
          bigPhoto.style.backgroundImage = cssUrl(photos[index]);
          bigPhoto.style.backgroundSize = "contain";
          bigPhoto.style.backgroundRepeat = "no-repeat";
          bigPhoto.style.backgroundPosition = "center";
          bigPhoto.style.backgroundColor = "#ffffff";
          counter.textContent = (index + 1) + "/" + photos.length;
          strip.querySelectorAll(".pv-thumb").forEach(function (t, n) {
            t.classList.toggle("on", n === index);
          });
        };

        photos.forEach(function (url, i) {
          const thumb = document.createElement("button");
          thumb.type = "button";
          thumb.className = "pv-thumb";
          thumb.style.backgroundImage = cssUrl(url);
          thumb.onclick = function () {
            show(i);
          };
          strip.appendChild(thumb);
        });

        let startX = null;
        bigPhoto.addEventListener("touchstart", function (e) {
          startX = e.touches[0].clientX;
        }, { passive: true });
        bigPhoto.addEventListener("touchend", function (e) {
          if (startX === null) return;
          const dx = e.changedTouches[0].clientX - startX;
          startX = null;
          if (dx > 40) show(index - 1);
          if (dx < -40) show(index + 1);
        }, { passive: true });

        show(0);
      }

      // Size and color choices
      const sizes = asList(product.sizes);
      const colors = asList(product.colors);
      const row = buyButton.closest(".buy-row");

      function group(title, kind, values) {
        return (
          "<p class='opt-title'>" + title + "</p><div class='opt-chips'>" +
          values.map(function (v) {
            return "<button type='button' class='opt-chip' data-kind='" + kind + "' data-value='" + esc(v) + "'>" + esc(v) + "</button>";
          }).join("") + "</div>"
        );
      }

      if ((sizes.length || colors.length) && row) {
        let html = "";
        if (sizes.length) html += group("Size", "size", sizes);
        if (colors.length) html += group("Color", "color", colors);
        html += "<p class='error' id='opt-msg'></p>";
        row.insertAdjacentHTML("beforebegin", "<div class='opt-box'>" + html + "</div>");

        document.querySelectorAll(".opt-chip").forEach(function (chip) {
          chip.onclick = function () {
            const kind = chip.getAttribute("data-kind");
            document.querySelectorAll(".opt-chip[data-kind='" + kind + "']").forEach(function (c) {
              c.classList.remove("on");
            });
            chip.classList.add("on");
            window.selectedOptions[kind] = chip.getAttribute("data-value");
            document.getElementById("opt-msg").textContent = "";
          };
        });
      }

      // Stop the buy buttons until the required options are chosen
      document.addEventListener("click", function (event) {
        const target = event.target.closest("#buy-once, #add-cart, #start-plan");
        if (!target) return;

        let missing = "";
        if (sizes.length && !window.selectedOptions.size) missing = "size";
        else if (colors.length && !window.selectedOptions.color) missing = "color";
        if (!missing) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const msg = document.getElementById("opt-msg");
        if (msg) msg.textContent = "Please choose a " + missing + ".";
        const box = document.querySelector(".opt-box");
        if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
      }, true);

      // Description
      if (product.description && String(product.description).trim()) {
        const panels = document.querySelectorAll("section.panel");
        const last = panels[panels.length - 1];
        if (last) {
          last.insertAdjacentHTML(
            "afterend",
            "<section class='panel'><h2>Description</h2><p class='pv-desc'>" +
            esc(product.description).replace(/\n/g, "<br>") + "</p></section>"
          );
        }
      }
    }
  }

  // ---------- Cart page: show size and color ----------
  const cartBox = document.getElementById("cart-items");
  if (cartBox && typeof renderCart === "function") {
    const decorate = function () {
      const items = getCart().filter(function (i) {
        return findProduct(i.id);
      });

      cartBox.querySelectorAll(".cart-item").forEach(function (el, index) {
        const item = items[index];
        if (!item || (!item.size && !item.color)) return;

        const parts = [];
        if (item.size) parts.push("Size: " + item.size);
        if (item.color) parts.push("Color: " + item.color);

        const name = el.querySelector(".cart-name");
        if (name) {
          name.insertAdjacentHTML("afterend", "<p class='plan-tag'>" + esc(parts.join(" · ")) + "</p>");
        }
      });
    };

    const originalRender = renderCart;
    renderCart = function () {
      originalRender();
      decorate();
    };
    renderCart();
  }

  // ---------- Checkout page: show size and color in the summary ----------
  const summaryBox = document.getElementById("order-summary");
  if (summaryBox) {
    const items = getCart().filter(function (i) {
      return findProduct(i.id);
    });
    const lines = summaryBox.querySelectorAll(".sum-line");

    items.forEach(function (item, index) {
      const line = lines[index];
      if (!line || (!item.size && !item.color)) return;

      const parts = [];
      if (item.size) parts.push("Size " + item.size);
      if (item.color) parts.push(item.color);

      const small = line.querySelector("small");
      if (small) small.textContent += " · " + parts.join(" · ");
    });
  }
})();