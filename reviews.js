// ================= REVIEWS: stars on cards, reviews on the product page =================
(function () {
  let stats = {};

  const style = document.createElement("style");
  style.textContent =
    ".rv-line{font-size:12px;color:#aaa;padding:2px 8px 0}" +
    ".rv-line b{color:#ffb800;font-weight:normal}" +
    ".rv-sum{margin:4px 0 12px;font-size:15px;color:#ccc}" +
    ".rv-sum b{color:#ffb800;font-weight:normal;letter-spacing:1px}" +
    ".rv-item{border-top:1px solid #2c2c2c;padding:14px 0}" +
    ".rv-top{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:4px}" +
    ".rv-stars{color:#ffb800;letter-spacing:1px}" +
    ".rv-meta{color:#888;font-size:12px}" +
    ".rv-verified{color:#6fcf73;font-size:12px}" +
    ".rv-text{color:#ddd;font-size:15px;line-height:1.5;margin-top:6px;white-space:pre-wrap}" +
    ".rv-form{background:#222;border-radius:12px;padding:14px;margin:12px 0}" +
    ".rv-pick{display:flex;gap:6px;margin:8px 0}" +
    ".rv-pick button{background:none;border:none;font-size:32px;color:#555;padding:0 2px}" +
    ".rv-pick button.on{color:#ffb800}" +
    ".rv-form textarea{width:100%;background:#111;color:#fff;border:1px solid #444;border-radius:10px;padding:10px;font-size:15px;font-family:Arial,sans-serif;min-height:90px}" +
    ".rv-note{color:#aaa;font-size:14px;line-height:1.5;margin:10px 0}" +
    ".rv-note a{color:#ff6a00}" +
    ".rv-del{background:none;border:1px solid #666;color:#aaa;border-radius:16px;padding:6px 12px;font-size:13px;margin-top:8px}";
  document.head.appendChild(style);

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function starText(n) {
    const full = Math.round(n);
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  function dateText(d) {
    const t = new Date(d);
    return isNaN(t) ? "" : t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  async function hdr(extra) {
    if (typeof Auth !== "undefined") return Auth.headers(extra);
    const h = { apikey: SUPABASE_KEY };
    for (const k in extra) h[k] = extra[k];
    return h;
  }

  function loggedIn() {
    return typeof Auth !== "undefined" && !!Auth.user();
  }

  async function rpc(name, body) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: await hdr({ "Content-Type": "application/json" }),
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  // ---------- Stars on the product cards ----------
  async function loadStats() {
    stats = {};
    try {
      const rows = await rpc("product_rating_stats", {});
      rows.forEach(function (r) {
        stats[r.product_id] = { avg: Number(r.avg_rating), count: r.review_count };
      });
    } catch (e) {}
  }

  function decorateCards() {
    document.querySelectorAll("#product-grid .card, #cat-grid .card, #wish-grid .card").forEach(function (card) {
      if (card.getAttribute("data-rv-done")) return;
      const id = Number((card.getAttribute("href") || "").split("id=")[1]);
      const s = stats[id];
      const name = card.querySelector(".name");
      if (!s || !name) return;

      card.setAttribute("data-rv-done", "1");
      name.insertAdjacentHTML(
        "afterend",
        "<p class='rv-line'><b>★</b> " + s.avg.toFixed(1) + " (" + s.count + ")</p>"
      );
    });
  }

  // ---------- The product page ----------
  async function productPage() {
    const buy = document.getElementById("buy-once");
    if (!buy) return;

    const productId = Number(new URLSearchParams(window.location.search).get("id"));
    if (!productId) return;

    const panels = document.querySelectorAll("section.panel");
    const last = panels[panels.length - 1];
    if (!last) return;

    last.insertAdjacentHTML("afterend", "<section class='panel' id='rv-panel'><h2>Reviews</h2><div id='rv-body'>Loading...</div></section>");

    let picked = 0;

    async function draw() {
      let list = [];
      let eligible = false;

      try {
        list = await rpc("product_reviews", { p_id: productId });
      } catch (e) {
        document.getElementById("rv-body").textContent = "Could not load reviews.";
        return;
      }

      if (loggedIn()) {
        try {
          eligible = await rpc("can_review", { p_id: productId });
        } catch (e) {}
      }

      const mine = list.find(function (r) { return r.mine; });
      const avg = list.length ? list.reduce(function (n, r) { return n + r.rating; }, 0) / list.length : 0;

      // Summary under the product name
      const nameEl = document.getElementById("product-name");
      const old = document.getElementById("rv-sum");
      if (old) old.remove();
      if (nameEl && list.length) {
        nameEl.insertAdjacentHTML(
          "afterend",
          "<p class='rv-sum' id='rv-sum'><b>" + starText(avg) + "</b> " + avg.toFixed(1) + " · " + list.length + (list.length === 1 ? " review" : " reviews") + "</p>"
        );
      }

      let html = "";

      if (mine) {
        html += "<p class='rv-note'>You reviewed this item. Thank you!</p>";
      } else if (!loggedIn()) {
        html += "<p class='rv-note'><a href='login.html?next=" + encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search) + "'>Log in</a> to write a review after your order is delivered.</p>";
      } else if (eligible) {
        html +=
          "<div class='rv-form'><strong>Rate this item</strong>" +
          "<div class='rv-pick' id='rv-pick'>" +
          [1, 2, 3, 4, 5].map(function (n) {
            return "<button type='button' data-star='" + n + "'>★</button>";
          }).join("") + "</div>" +
          "<textarea id='rv-text' maxlength='1000' placeholder='Tell others what you think (optional)'></textarea>" +
          "<p class='error' id='rv-msg'></p>" +
          "<button class='start-plan' id='rv-send'>Submit review</button></div>";
      } else {
        html += "<p class='rv-note'>Only customers who have received this item can review it.</p>";
      }

      if (list.length === 0) {
        html += "<p class='rv-note'>No reviews yet.</p>";
      } else {
        html += list.map(function (r) {
          return (
            "<div class='rv-item'><div class='rv-top'><span><span class='rv-stars'>" + starText(r.rating) + "</span> " + esc(r.author_name) + "</span>" +
            "<span class='rv-meta'>" + esc(dateText(r.created_at)) + "</span></div>" +
            "<span class='rv-verified'>✓ Verified purchase</span>" +
            (r.body ? "<p class='rv-text'>" + esc(r.body) + "</p>" : "") +
            (r.mine ? "<button class='rv-del' data-del='1'>Delete my review</button>" : "") + "</div>"
          );
        }).join("");
      }

      document.getElementById("rv-body").innerHTML = html;
      picked = 0;
    }

    document.getElementById("rv-panel").addEventListener("click", async function (event) {
      const star = event.target.closest("[data-star]");
      if (star) {
        picked = Number(star.getAttribute("data-star"));
        document.querySelectorAll("#rv-pick button").forEach(function (b) {
          b.classList.toggle("on", Number(b.getAttribute("data-star")) <= picked);
        });
        return;
      }

      if (event.target.closest("[data-del]")) {
        if (!confirm("Delete your review?")) return;
        const res = await fetch(SUPABASE_URL + "/rest/v1/reviews?product_id=eq." + productId, {
          method: "DELETE",
          headers: await hdr()
        });
        if (res.ok) draw();
        else alert("Could not delete your review.");
        return;
      }

      if (event.target.closest("#rv-send")) {
        const msg = document.getElementById("rv-msg");
        msg.style.color = "#ff5a5a";

        if (!picked) {
          msg.textContent = "Please tap the stars to rate this item.";
          return;
        }

        const btn = document.getElementById("rv-send");
        btn.disabled = true;

        const res = await fetch(SUPABASE_URL + "/rest/v1/reviews", {
          method: "POST",
          headers: await hdr({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({
            product_id: productId,
            rating: picked,
            body: document.getElementById("rv-text").value.trim() || null
          })
        });

        if (res.ok) {
          draw();
          return;
        }

        btn.disabled = false;
        if (res.status === 409) msg.textContent = "You have already reviewed this item.";
        else if (res.status === 401 || res.status === 403) msg.textContent = "You can review this item after it has been delivered to you.";
        else msg.textContent = "Could not save your review (" + res.status + ").";
      }
    });

    draw();
  }

  // ---------- Start ----------
  loadStats().then(function () {
    decorateCards();

    ["product-grid", "cat-grid", "wish-grid"].forEach(function (id) {
      const grid = document.getElementById(id);
      if (grid) new MutationObserver(decorateCards).observe(grid, { childList: true });
    });
  });

  productPage();
})();