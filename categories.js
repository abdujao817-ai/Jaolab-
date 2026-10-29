// ================= CATEGORIES PAGE: browse, search, filter and sort =================
(function () {
  const PAGE = 12;
  const LOW = 5;
  const DEFAULT_CATS = ["Women", "Men", "Kids", "Shoes", "Bags", "Accessories"];
  const params = new URLSearchParams(window.location.search);

  const state = {
    cat: params.get("cat") || "All",
    q: (params.get("q") || "").trim().toLowerCase(),
    sort: "recommended",
    min: null,
    max: null,
    inStock: false,
    shown: PAGE
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function counted(p) {
    return p.stock_qty !== null && p.stock_qty !== undefined;
  }

  function available(p) {
    return p.in_stock !== false && (!counted(p) || p.stock_qty > 0);
  }

  // ---------- Categories ----------
  function categoryList() {
    const extra = [];
    products.forEach(function (p) {
      if (p.category && DEFAULT_CATS.indexOf(p.category) === -1 && extra.indexOf(p.category) === -1) {
        extra.push(p.category);
      }
    });
    return ["All"].concat(DEFAULT_CATS, extra);
  }

  function countIn(cat) {
    return products.filter(function (p) {
      return cat === "All" || p.category === cat;
    }).length;
  }

  // ---------- Filtering and sorting ----------
  function filtered() {
    let list = products.filter(function (p) {
      if (state.cat !== "All" && p.category !== state.cat) return false;

      if (state.q) {
        const text = (p.name + " " + p.category + " " + (p.description || "")).toLowerCase();
        if (text.indexOf(state.q) === -1) return false;
      }

      if (state.min !== null && p.price < state.min) return false;
      if (state.max !== null && p.price > state.max) return false;
      if (state.inStock && !available(p)) return false;
      return true;
    }).slice();

    if (state.sort === "price-asc") {
      list.sort(function (a, b) { return a.price - b.price; });
    } else if (state.sort === "price-desc") {
      list.sort(function (a, b) { return b.price - a.price; });
    } else if (state.sort === "name") {
      list.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    } else if (state.sort === "newest") {
      list.sort(function (a, b) {
        return String(b.created_at || "").localeCompare(String(a.created_at || "")) || b.id - a.id;
      });
    } else {
      // Recommended: items you can buy come first
      list.sort(function (a, b) {
        return Number(available(b)) - Number(available(a));
      });
    }

    return list;
  }

  // ---------- Drawing ----------
  function card(p) {
    const ok = available(p);
    let badge = "";

    if (!ok) {
      badge = "<span class='so-badge'>Sold out</span>";
    } else if (counted(p) && p.stock_qty <= LOW) {
      badge = "<span class='so-badge low-badge'>Only " + p.stock_qty + " left</span>";
    }

    return (
      "<a href='product.html?id=" + p.id + "' class='card" + (ok ? "" : " soldout") + "'>" +
      "<div class='photo' style=\"position:relative;" + photoStyle(p) + "\">" + badge + "</div>" +
      "<p class='name'>" + esc(p.name) + "</p>" +
      "<p class='price'>" + formatPrice(p.price) + "</p></a>"
    );
  }

  function render() {
    const list = filtered();

    // Category list
    $("cat-rail").innerHTML = categoryList().filter(function (c) {
      return c === "All" || c === state.cat || countIn(c) > 0;
    }).map(function (c) {
      return (
        "<button type='button' class='cat-item" + (c === state.cat ? " on" : "") + "' data-cat='" + esc(c) + "'>" +
        esc(c) + "<small>" + countIn(c) + " items</small></button>"
      );
    }).join("");

    // Products
    const grid = $("cat-grid");
    if (list.length === 0) {
      grid.innerHTML = "<div class='cat-empty' style='grid-column:1/-1'>No products match.<br>Try another category or reset the filters.</div>";
    } else {
      grid.innerHTML = list.slice(0, state.shown).map(card).join("");
    }

    $("cat-title").textContent = state.cat;
    $("cat-count").textContent = list.length + (list.length === 1 ? " item" : " items");
    $("cat-more").style.display = list.length > state.shown ? "block" : "none";

    // The Filters button shows when something is applied
    const active = (state.min !== null) + (state.max !== null) + (state.inStock ? 1 : 0);
    $("cat-fbtn").textContent = active ? "Filters (" + active + ")" : "Filters";
    $("cat-fbtn").className = "cat-fbtn" + (active ? " on" : "");

    // Keep the category list just under the sticky header
    const head = document.querySelector(".cat-head");
    const rail = $("cat-rail");
    rail.style.top = head.offsetHeight + "px";
    rail.style.maxHeight = "calc(100vh - " + (head.offsetHeight + 70) + "px)";
  }

  function remember() {
    try {
      let url = "categories.html";
      const q = [];
      if (state.cat !== "All") q.push("cat=" + encodeURIComponent(state.cat));
      if (state.q) q.push("q=" + encodeURIComponent(state.q));
      if (q.length) url += "?" + q.join("&");
      history.replaceState(null, "", url);
    } catch (e) {}
  }

  // ---------- Controls ----------
  $("cat-rail").onclick = function (event) {
    const item = event.target.closest(".cat-item");
    if (!item) return;
    state.cat = item.getAttribute("data-cat");
    state.shown = PAGE;
    remember();
    render();
    window.scrollTo(0, 0);
  };

  let timer = null;
  $("cat-search").oninput = function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = $("cat-search").value.trim().toLowerCase();
      state.shown = PAGE;
      remember();
      render();
    }, 200);
  };

  $("cat-sort").onchange = function () {
    state.sort = $("cat-sort").value;
    state.shown = PAGE;
    render();
  };

  $("cat-more").onclick = function () {
    state.shown += PAGE;
    render();
  };

  const sheet = $("cat-sheet");

  $("cat-fbtn").onclick = function () {
    $("f-min").value = state.min === null ? "" : state.min;
    $("f-max").value = state.max === null ? "" : state.max;
    $("f-stock").checked = state.inStock;
    sheet.classList.add("show");
  };

  sheet.onclick = function (event) {
    if (event.target === sheet) sheet.classList.remove("show");
  };

  $("f-apply").onclick = function () {
    const min = $("f-min").value;
    const max = $("f-max").value;
    state.min = min === "" ? null : Math.max(0, Number(min));
    state.max = max === "" ? null : Math.max(0, Number(max));
    state.inStock = $("f-stock").checked;
    state.shown = PAGE;
    sheet.classList.remove("show");
    render();
  };

  $("f-reset").onclick = function () {
    state.min = null;
    state.max = null;
    state.inStock = false;
    state.shown = PAGE;
    sheet.classList.remove("show");
    render();
  };

  // ---------- Start ----------
  if (categoryList().indexOf(state.cat) === -1) {
    state.cat = "All";
  }
  $("cat-search").value = state.q;
  render();
})();