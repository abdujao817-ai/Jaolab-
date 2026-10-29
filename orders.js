// ================= YOUR ORDERS (Temu style) =================
(function () {
  const box = document.getElementById("orders-box");
  if (!box) return;

  const STATUS = {
    awaiting_verification: { title: "Awaiting payment verification", tab: "processing", tone: "wait",
      msg: "We're checking your payment. Your order moves forward once it's verified." },
    payment_verified: { title: "Payment verified", tab: "processing", tone: "ok",
      msg: "Your payment is verified and we're getting your order ready." },
    processing: { title: "Processing", tab: "processing", tone: "ok",
      msg: "We're preparing your order." },
    dispatched: { title: "Dispatched", tab: "shipped", tone: "ok",
      msg: "Your order has been dispatched." },
    delivered: { title: "Delivered", tab: "delivered", tone: "ok",
      msg: "Your order has been delivered." },
    payment_rejected: { title: "Payment not verified", tab: "cancelled", tone: "bad",
      msg: "We couldn't verify your payment. Email us if you think this is a mistake." },
    cancelled: { title: "Cancelled", tab: "cancelled", tone: "bad",
      msg: "This order was cancelled." }
  };

  const TABS = [
    ["all", "All orders"],
    ["processing", "Processing"],
    ["shipped", "Shipped"],
    ["delivered", "Delivered"],
    ["cancelled", "Cancelled"]
  ];

  let orders = [];
  let currentTab = "all";
  let openRef = null;
  let notice = "";
  let byId = {};
  let byName = {};

  // ---------- styles ----------
  const style = document.createElement("style");
  style.textContent =
    ".oc-tabs{display:flex;gap:22px;overflow-x:auto;white-space:nowrap;padding:4px 16px 0;border-bottom:1px solid #2a2a2a}" +
    ".oc-tab{background:none;border:none;color:#aaa;font-size:16px;padding:10px 0;border-bottom:3px solid transparent}" +
    ".oc-tab.on{color:#fff;font-weight:bold;border-bottom-color:#ff6a00}" +
    ".oc-guarantee{margin:12px;border:1px solid #2e7d32;color:#6fcf73;border-radius:10px;padding:10px 12px;font-size:14px}" +
    ".oc-notice{margin:12px;color:#ffb066;font-size:13px}" +
    ".oc-card{background:#1a1a1a;border-radius:14px;margin:12px;padding:14px}" +
    ".oc-title{font-size:18px;font-weight:bold;margin-bottom:10px}" +
    ".oc-row{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ".oc-thumbs{display:flex;gap:8px;align-items:center}" +
    ".oc-thumb{width:64px;height:64px;border-radius:8px;background:#fff center/contain no-repeat}" +
    ".oc-more{color:#aaa;font-size:14px}" +
    ".oc-sum{text-align:right}" +
    ".oc-sum strong{display:block;font-size:18px}" +
    ".oc-sum span{color:#aaa;font-size:14px}" +
    ".oc-msg{margin:12px 0 4px;font-size:15px;line-height:1.5}" +
    ".oc-wait{color:#ffb066}.oc-ok{color:#6fcf73}.oc-bad{color:#ff7a7a}" +
    ".oc-note{color:#ddd;font-size:14px;margin:6px 0}" +
    ".oc-total{display:flex;justify-content:space-between;background:#222;border-radius:8px;padding:12px;margin:12px 0}" +
    ".oc-date{color:#888;font-size:13px;margin-bottom:12px}" +
    ".oc-actions{display:flex;justify-content:flex-end;gap:10px}" +
    ".oc-btn{border:1px solid #666;background:none;color:#fff;border-radius:22px;padding:10px 16px;font-size:15px;text-decoration:none}" +
    ".oc-btn.main{background:#ff6a00;border-color:#ff6a00;font-weight:bold}" +
    ".oc-details{border-top:1px solid #333;margin-top:12px;padding-top:10px}" +
    ".oc-item{display:flex;gap:10px;padding:8px 0}" +
    ".oc-item .oc-thumb{width:52px;height:52px;flex-shrink:0}" +
    ".oc-item small{display:block;color:#aaa;font-size:12px;margin-top:2px}" +
    ".oc-line{display:flex;justify-content:space-between;color:#ccc;font-size:14px;padding:4px 0}" +
    ".oc-empty{text-align:center;padding:60px 24px;color:#aaa}" +
    ".oc-empty a{display:inline-block;margin-top:16px;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;border-radius:12px;padding:12px 22px}";
  document.head.appendChild(style);

  // ---------- helpers ----------
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "₦" + Number(n).toLocaleString();
  }

  function fmtDate(d) {
    const t = new Date(d);
    return isNaN(t) ? String(d || "") : t.toLocaleString();
  }

  function hdr(extra) {
    const h = { apikey: SUPABASE_KEY };
    if (SUPABASE_KEY.indexOf("eyJ") === 0) {
      h.Authorization = "Bearer " + SUPABASE_KEY;
    }
    for (const key in extra) {
      h[key] = extra[key];
    }
    return h;
  }

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem("jaolabOrders")) || [];
    } catch (e) {
      return [];
    }
  }

  function photoUrl(item) {
    const p = byId[item.id] || byName[item.name];
    let url = p && p.image_url;
    if (!url && typeof localImages !== "undefined" && localImages[item.name]) {
      url = localImages[item.name];
    }
    return url || "";
  }

  function photoCss(item) {
    const url = photoUrl(item);
    if (!url) return "";
    const safe = url.replace(/'/g, "%27").replace(/"/g, "%22").replace(/\(/g, "%28").replace(/\)/g, "%29");
    return "background-image:url('" + safe + "')";
  }

  // ---------- data ----------
  function fromLocal(l) {
    return {
      ref: l.ref,
      date: l.date,
      status: "awaiting_verification",
      items: (l.items || []).map(function (i) {
        const p = byId[i.id];
        return {
          id: i.id, name: p ? p.name : "Item", price: p ? p.price : null,
          qty: i.qty, mode: i.mode, frequency: i.frequency, count: i.count
        };
      }),
      itemsTotal: null,
      deliveryFee: null,
      payNow: l.payNow,
      note: null
    };
  }

  function fromRow(r) {
    return {
      ref: r.reference,
      date: r.created_at,
      status: r.status,
      items: r.items || [],
      itemsTotal: r.items_total,
      deliveryFee: r.delivery_fee,
      payNow: r.pay_now,
      discount: r.discount || 0,
      note: r.admin_note
    };
  }

  async function loadProductInfo() {
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/products?select=id,name,price,image_url", { headers: hdr() });
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach(function (p) {
        byId[p.id] = p;
        byName[p.name] = p;
      });
    } catch (e) {}
  }

  async function fetchOrders(refs) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_orders", {
      method: "POST",
      headers: await Auth.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ refs: refs })
    });
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    return res.json();
  }

  // ---------- drawing ----------
  function itemDetail(i) {
    let how = "Pay once";
    if (i.mode === "installment") {
      const unit = i.frequency === "Weekly" ? "week" : "month";
      how = "Installment plan: " + i.count + " " + unit + "s";
    }
    const price = i.price != null ? money(i.price) + " · " : "";
    return (
      "<div class='oc-item'><div class='oc-thumb' style=\"" + photoCss(i) + "\"></div>" +
      "<div><div>" + esc(i.name) + " × " + esc(i.qty) + "</div>" +
      "<small>" + price + how + "</small></div></div>"
    );
  }

  function card(o) {
    const s = STATUS[o.status] || { title: o.status, tone: "wait", msg: "" };
    const count = o.items.reduce(function (n, i) {
      return n + Number(i.qty || 1);
    }, 0);
    const thumbs = o.items.slice(0, 3).map(function (i) {
      return "<div class='oc-thumb' style=\"" + photoCss(i) + "\"></div>";
    }).join("");
    const more = o.items.length > 3 ? "<span class='oc-more'>+" + (o.items.length - 3) + "</span>" : "";
    const installment = o.items.some(function (i) {
      return i.mode === "installment";
    });

    let html =
      "<div class='oc-card'>" +
      "<div class='oc-title'>" + esc(s.title) + "</div>" +
      "<div class='oc-row'><div class='oc-thumbs'>" + thumbs + more + "</div>" +
      "<div class='oc-sum'><strong>" + money(o.payNow) + "</strong><span>" + count + (count === 1 ? " item" : " items") + "</span></div></div>" +
      "<p class='oc-msg oc-" + s.tone + "'>" + esc(s.msg) + "</p>";

    if (o.note) {
      html += "<p class='oc-note'>Note from the store: " + esc(o.note) + "</p>";
    }
    if (installment) {
      html += "<p class='oc-note'>Installment order: it is dispatched after the final payment is verified.</p>";
    }

    html +=
      "<div class='oc-total'><span>Paid now:</span><strong>" + money(o.payNow) + "</strong></div>" +
      "<div class='oc-date'>Ordered " + esc(fmtDate(o.date)) + " · " + esc(o.ref) + "</div>";

    if (openRef === o.ref) {
      html += "<div class='oc-details'>" + o.items.map(itemDetail).join("");
      if (o.itemsTotal != null) {
        html += "<div class='oc-line'><span>Items</span><span>" + money(o.itemsTotal) + "</span></div>";
      }
      if (o.deliveryFee != null) {
        html += "<div class='oc-line'><span>Delivery</span><span>" + money(o.deliveryFee) + "</span></div>";
      }
      html += "<div class='oc-line'><span>Paid now</span><span>" + money(o.payNow) + "</span></div></div>";
    }

    html += window.installmentBlock ? window.installmentBlock(o, openRef === o.ref) : "";
    const first = o.items[0];
    html +=
      "<div class='oc-actions'>" +
      "<button class='oc-btn' data-toggle='" + esc(o.ref) + "'>" + (openRef === o.ref ? "Hide details" : "Order details") + "</button>" +
      (first ? "<a class='oc-btn main' href='product.html?id=" + esc(first.id) + "'>Buy this again</a>" : "") +
      "</div></div>";

    return html;
  }

  function render() {
    const list = orders.filter(function (o) {
      return currentTab === "all" || (STATUS[o.status] || {}).tab === currentTab;
    });

    let html = "<div class='oc-tabs'>" + TABS.map(function (t) {
      return "<button class='oc-tab" + (currentTab === t[0] ? " on" : "") + "' data-tab='" + t[0] + "'>" + t[1] + "</button>";
    }).join("") + "</div>";

    html += "<div class='oc-guarantee'>We verify every payment before an order is dispatched.</div>";
    html += window.installmentAlert ? window.installmentAlert(orders) : "";
    
    if (notice) {
      html += "<p class='oc-notice'>" + esc(notice) + "</p>";
    }

    if (list.length === 0) {
      html += "<div class='oc-empty'><p>" +
        (orders.length === 0 ? "You have no orders yet" : "No orders in this tab") +
        "</p><a href='index.html'>Start shopping</a></div>";
    } else {
      html += list.map(card).join("");
    }

    box.innerHTML = html;
  }

  box.onclick = function (event) {
    const t = event.target.closest("[data-tab],[data-toggle]");
    if (!t) return;
    if (t.getAttribute("data-tab")) {
      currentTab = t.getAttribute("data-tab");
      render();
    }
    if (t.getAttribute("data-toggle")) {
      const ref = t.getAttribute("data-toggle");
      openRef = openRef === ref ? null : ref;
      render();
    }
  };

  // ---------- start ----------
  async function start() {
    box.innerHTML = "<p class='oc-notice'>Loading your orders...</p>";

    const local = readLocal();
    const loggedIn = typeof Auth !== "undefined" && !!Auth.user();

    if (local.length === 0 && !loggedIn) {
      orders = [];
      render();
      return;
    }

    await loadProductInfo();
    orders = local.slice().reverse().map(fromLocal);
    render();

    try {
      const rows = await fetchOrders(local.map(function (l) {
        return l.ref;
      }));
      orders = rows.map(fromRow);
      notice = "";

      if (window.loadSchedule) {
        await window.loadSchedule(orders.map(function (o) {
          return o.ref;
        }));
      }
    } catch (e) {
      notice = "Couldn't refresh your order status (error " + e.message + "). Showing what is saved on this phone.";
    }

    render();
  }

  window.refreshOrders = start;
  start();
})();