// ================= ADMIN: ORDERS =================
const STATUS_LABELS = {
  awaiting_verification: "Awaiting verification",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  processing: "Processing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

let adminOrders = [];
let ordersReady = false;

(function addOrderStyles() {
  const style = document.createElement("style");
  style.textContent =
    ".o-card{border-top:1px solid #333;padding:14px 0}" +
    ".o-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}" +
    ".o-meta{color:#aaa;font-size:13px;margin:6px 0;line-height:1.5}" +
    ".o-items{margin:8px 0;font-size:14px}" +
    ".o-items small{display:block;color:#aaa}" +
    ".o-lock{background:#3a2a10;color:#ffb066;border-radius:8px;padding:8px;font-size:13px;margin:8px 0}" +
    ".o-note{color:#ff9a9a;font-size:13px;margin:6px 0}" +
    ".o-receipt{margin:8px 0}";
  document.head.appendChild(style);
})();

function naira(amount) {
  return "₦" + Number(amount).toLocaleString();
}

function hasInstallment(order) {
  return (order.items || []).some(function (item) {
    return item.mode === "installment";
  });
}

function orderButton(order, status, label) {
  return "<button data-act='status' data-id='" + order.id + "' data-status='" + status + "'>" + label + "</button>";
}

function orderButtons(order) {
  let html = "";
  const locked = hasInstallment(order) && !(window.installmentsDone && window.installmentsDone(order));

  if (order.status === "awaiting_verification") {
    html += orderButton(order, "payment_verified", "Verify payment");
    html += orderButton(order, "payment_rejected", "Reject payment");
  }

  if (!locked) {
    if (order.status === "payment_verified") html += orderButton(order, "processing", "Start processing");
    if (order.status === "processing") html += orderButton(order, "dispatched", "Mark dispatched");
    if (order.status === "dispatched") html += orderButton(order, "delivered", "Mark delivered");
  }

  if (order.status !== "delivered" && order.status !== "cancelled") {
    html += orderButton(order, "cancelled", "Cancel order");
  }

  return html;
}

function itemLine(item) {
  let how = "Pay once";
  if (item.mode === "installment") {
    const unit = item.frequency === "Weekly" ? "week" : "month";
    how = "Installment: " + item.count + " " + unit + "s";
  }
  "<div><div>" + esc(i.name) + " × " + esc(i.qty) + (i.size ? " · " + esc(i.size) : "") + (i.color ? " · " + esc(i.color) : "") + "</div>" +
    "<small>" + naira(item.price) + " · " + how + "</small>";
}

function renderOrders() {
  const box = document.getElementById("orders-admin");

  if (adminOrders.length === 0) {
    box.innerHTML = "<p class='hint'>No orders here yet.</p>";
    return;
  }

  box.innerHTML = adminOrders.map(function (o) {
    const items = (o.items || []).map(function (item) {
      return "<div>" + itemLine(item) + "</div>";
    }).join("");

    const lock = (hasInstallment(o) && !(window.installmentsDone && window.installmentsDone(o)))
      ? "<div class='o-lock'>Installment order: dispatch stays locked until every installment payment below is verified.</div>"
      : "";

    const note = o.admin_note ? "<div class='o-note'>Note: " + escapeHtml(o.admin_note) + "</div>" : "";

    return (
      "<div class='o-card'>" +
      "<div class='o-top'><strong>" + escapeHtml(o.reference) + "</strong>" +
      "<span class='status'>" + (STATUS_LABELS[o.status] || escapeHtml(o.status)) + "</span></div>" +
      "<div class='o-meta'>" + new Date(o.created_at).toLocaleString() + "<br>" +
      escapeHtml(o.customer_name) + " · <a href='tel:" + escapeHtml(o.phone) + "'>" + escapeHtml(o.phone) + "</a>" +
      (o.email ? "<br>" + escapeHtml(o.email) : "") + "<br>" +
      escapeHtml(o.address) + ", " + escapeHtml(o.state) +
      (o.notes ? "<br>Notes: " + escapeHtml(o.notes) : "") + "</div>" +
      "<div class='o-items'>" + items + "</div>" +
      "<div class='o-meta'>Items " + naira(o.items_total) + " · Delivery " + naira(o.delivery_fee) +
      " · <strong>Customer says they paid " + naira(o.pay_now) + "</strong>" +
      (o.discount > 0 ? " · Referral discount " + naira(o.discount) : "") + "</div>" +
      lock + note + (window.adminSchedule ? window.adminSchedule(o) : "") +
      "<div class='o-receipt' id='receipt-" + o.id + "'></div>" +
      "<div class='a-btns'>" +
      "<button data-act='receipt' data-id='" + o.id + "'>View receipt</button>" +
      orderButtons(o) +
      "</div></div>"
    );
  }).join("");
}

async function loadOrders() {
  const box = document.getElementById("orders-admin");

  if (!ordersReady) {
    ordersReady = true;
    box.onclick = ordersClick;
    document.getElementById("order-filter").onchange = loadOrders;
  }

  box.textContent = "Loading orders...";

  let url = SUPABASE_URL + "/rest/v1/orders?select=*&order=created_at.desc&limit=100";
  const filter = document.getElementById("order-filter").value;
  if (filter) {
    url += "&status=eq." + filter;
  }

  const res = await fetch(url, { headers: authHeaders() });
  if (expired(res)) return;
  if (!res.ok) {
    box.textContent = "Could not load orders (" + res.status + ").";
    return;
  }

  adminOrders = await res.json();
  if (window.loadInstallments) {
    await window.loadInstallments(adminOrders);
  }
  renderOrders();
}

async function showReceipt(order) {
  const holder = document.getElementById("receipt-" + order.id);

  if (!order.receipt_path) {
    holder.textContent = "No receipt uploaded.";
    return;
  }

  holder.textContent = "Opening receipt...";

  const res = await fetch(
    SUPABASE_URL + "/storage/v1/object/sign/receipts/" + encodeURIComponent(order.receipt_path),
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: 300 })
    }
  );

  if (expired(res)) return;
  if (!res.ok) {
    holder.textContent = "Could not open the receipt (" + res.status + ").";
    return;
  }

  const data = await res.json();
  const link = SUPABASE_URL + "/storage/v1" + data.signedURL;
  holder.innerHTML = "<a class='mini' target='_blank' rel='noopener' href='" + link + "'>Tap to open receipt (valid 5 minutes)</a>";
}

async function changeStatus(id, status) {
  const order = adminOrders.find(function (o) {
    return o.id === id;
  });
  if (!order) return;

  if (status === "payment_verified") {
    const ok = confirm(
      "Verify this payment?\n\nCheck the receipt really shows " + naira(order.pay_now) +
      " sent to your account."
    );
    if (!ok) return;
  }

  const body = { status: status };

  if (status === "payment_rejected" || status === "cancelled") {
    const reason = prompt("Reason (optional):");
    if (reason === null) return;
    body.admin_note = reason.trim() || null;
  }

  const res = await fetch(SUPABASE_URL + "/rest/v1/orders?id=eq." + id, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body)
  });

  if (expired(res)) return;
  if (!res.ok) {
    alert("Could not update the order (" + res.status + ").");
    return;
  }

  loadOrders();
}

function ordersClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.getAttribute("data-id"));
  const act = button.getAttribute("data-act");
  const order = adminOrders.find(function (o) {
    return o.id === id;
  });
  if (!order) return;

  if (act === "receipt") showReceipt(order);
  if (act === "status") changeStatus(id, button.getAttribute("data-status"));
}