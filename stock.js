// ================= STOCK: badges, limits and sold-out handling =================
(function () {
  const LOW = 5; // "Only N left" shows at this number or below

  const style = document.createElement("style");
  style.textContent =
    ".so-badge{position:absolute;top:8px;left:8px;background:#c0392b;color:#fff;font-size:12px;font-weight:bold;border-radius:12px;padding:4px 10px}" +
    ".low-badge{background:#b8741a}" +
    ".card.soldout{opacity:.55}" +
    ".so-note{background:#3a1414;border:1px solid #c0392b;color:#ff9a9a;border-radius:10px;padding:10px 12px;font-size:14px;margin:12px 0}" +
    ".low-note{background:#3a2a10;border-color:#b8741a;color:#ffb066}" +
    ".cart-warn{color:#ff9a9a;font-size:13px;margin-top:6px}";
  document.head.appendChild(style);

  // Is this product available, and how many are left (null = not counted)?
  function info(p) {
    if (!p) return { ok: false, left: 0 };
    const counted = p.stock_qty !== null && p.stock_qty !== undefined;
    return {
      ok: p.in_stock !== false && (!counted || p.stock_qty > 0),
      left: counted ? p.stock_qty : null
    };
  }

  // ---------- Home page: badges on the product cards ----------
  function decorateGrid() {
    document.querySelectorAll("#product-grid .card").forEach(function (card) {
      const id = Number((card.getAttribute("href") || "").split("id=")[1]);
      const s = info(findProduct(id));
      const photo = card.querySelector(".photo");
      if (!photo) return;

      photo.style.position = "relative";

      if (!s.ok) {
        card.classList.add("soldout");
        photo.insertAdjacentHTML("beforeend", "<span class='so-badge'>Sold out</span>");
      } else if (s.left !== null && s.left <= LOW) {
        photo.insertAdjacentHTML("beforeend", "<span class='so-badge low-badge'>Only " + s.left + " left</span>");
      }
    });
  }

  if (document.getElementById("product-grid") && typeof showProducts === "function") {
    const originalShow = showProducts;
    showProducts = function () {
      originalShow();
      decorateGrid();
    };
    showProducts();
  }

  // ---------- Product page: block buying a sold-out item ----------
  const buyButton = document.getElementById("buy-once");
  if (buyButton) {
    const productId = Number(new URLSearchParams(window.location.search).get("id"));
    const s = info(findProduct(productId));
    const row = buyButton.closest(".buy-row");

    if (!s.ok) {
      ["buy-once", "add-cart", "start-plan"].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
          el.disabled = true;
          el.style.opacity = "0.45";
        }
      });
      document.querySelectorAll("[data-frequency]").forEach(function (b) {
        b.disabled = true;
        b.style.opacity = "0.45";
      });
      buyButton.textContent = "Sold out";
      if (row) row.insertAdjacentHTML("beforebegin", "<div class='so-note'>This item is currently out of stock.</div>");
    } else if (s.left !== null && s.left <= LOW && row) {
      row.insertAdjacentHTML("beforebegin", "<div class='so-note low-note'>Only " + s.left + " left in stock.</div>");
    }
  }

  // ---------- Cart page: warn about items that ran out ----------
  const cartBox = document.getElementById("cart-items");
  if (cartBox && typeof renderCart === "function") {
    function decorateCart() {
      const items = getCart().filter(function (i) {
        return findProduct(i.id);
      });
      let blocked = false;

      cartBox.querySelectorAll(".cart-item").forEach(function (el, index) {
        const item = items[index];
        if (!item) return;

        const s = info(findProduct(item.id));
        const total = items.filter(function (i) {
          return i.id === item.id;
        }).reduce(function (n, i) {
          return n + i.qty;
        }, 0);

        let warn = "";
        if (!s.ok) {
          warn = "This item is out of stock. Remove it to continue.";
        } else if (s.left !== null && total > s.left) {
          warn = "Only " + s.left + " left. Reduce the quantity to continue.";
        }

        if (warn) {
          blocked = true;
          el.querySelector(".cart-info").insertAdjacentHTML("beforeend", "<p class='cart-warn'>" + warn + "</p>");
        }
      });

      const checkout = cartBox.querySelector("a[href='checkout.html']");
      if (checkout && blocked) {
        checkout.style.opacity = "0.45";
        checkout.addEventListener("click", function (event) {
          event.preventDefault();
          alert("Please fix the items marked in red before checking out.");
        });
      }
    }

    const originalRender = renderCart;
    renderCart = function () {
      originalRender();
      decorateCart();
    };

    const originalQty = changeQty;
    changeQty = function (index, change) {
      if (change > 0) {
        const cart = getCart();
        const item = cart[index];
        if (item) {
          const s = info(findProduct(item.id));
          const total = cart.filter(function (i) {
            return i.id === item.id;
          }).reduce(function (n, i) {
            return n + i.qty;
          }, 0);
          if (s.left !== null && total + 1 > s.left) {
            alert("Only " + s.left + " left in stock.");
            return;
          }
        }
      }
      originalQty(index, change);
    };

    renderCart();
  }
})();