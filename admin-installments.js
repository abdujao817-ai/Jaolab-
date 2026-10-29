// ================= ADMIN: INSTALLMENT PAYMENTS AND OVERDUE LIST =================
(function () {
  let instByOrder = {};

  const style = document.createElement("style");
  style.textContent =
    ".ia-box{background:#222;border-radius:10px;padding:12px;margin:10px 0}" +
    ".ia-head{font-weight:bold;margin-bottom:6px}" +
    ".ia-item{margin-top:10px;color:#ccc;font-size:14px}" +
    ".ia-row{padding:8px 0;border-top:1px solid #333;font-size:14px}" +
    ".ia-row small{display:block;margin:3px 0 6px;font-size:13px}" +
    ".ia-ov{border-top:1px solid #333;padding:12px 0;font-size:14px;line-height:1.6}" +
    ".ia-ov small{color:#aaa}";
  document.head.appendChild(style);

  function lagosToday() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  }

  function stageOf(r) {
    if (r.status === "verified") return ["Verified ✓", "#6fcf73"];
    if (r.status === "submitted") {
      return [r.seq === 1 ? "First payment (checked with the order payment)" : "Receipt submitted: needs your check", "#ffb066"];
    }
    if (r.status === "rejected") return ["Rejected" + (r.admin_note ? ": " + r.admin_note : ""), "#ff7a7a"];
    if (!r.due_date) return ["Waiting for the first payment to be verified", "#aaa"];

    const today = lagosToday();
    if (today < r.due_date) return ["Due " + r.due_date, "#aaa"];
    if (today === r.due_date) return ["Due today", "#ffb066"];
    if (today <= r.grace_until) return ["Past due, grace until " + r.grace_until, "#ffb066"];
    return ["Overdue since " + r.grace_until, "#ff7a7a"];
  }

  // Is every installment of this order verified?
  window.installmentsDone = function (o) {
    const rows = instByOrder[o.id];
    return !!(rows && rows.length > 0 && rows.every(function (r) {
      return r.status === "verified";
    }));
  };

  // The schedule shown inside each order card
  window.adminSchedule = function (o) {
    const rows = instByOrder[o.id];
    if (!rows || rows.length === 0) return "";

    let html = "<div class='ia-box'><div class='ia-head'>Installment payments</div>";
    let lastItem = -1;

    rows.forEach(function (r) {
      if (r.item_index !== lastItem) {
        lastItem = r.item_index;
        html += "<div class='ia-item'>" + escapeHtml(r.item_name) + " · " + escapeHtml(r.frequency) + "</div>";
      }

      const s = stageOf(r);
      let buttons = "";
      if (r.status === "submitted" && r.seq > 1) {
        buttons =
          "<div class='a-btns'>" +
          "<button data-iact='receipt' data-iid='" + r.id + "'>View receipt</button>" +
          "<button data-iact='verify' data-iid='" + r.id + "'>Verify</button>" +
          "<button data-iact='reject' data-iid='" + r.id + "'>Reject</button>" +
          "</div><div id='ireceipt-" + r.id + "'></div>";
      }

      html +=
        "<div class='ia-row'>Payment " + r.seq + " of " + r.total_count +
        " · <strong>" + naira(r.amount) + "</strong>" +
        "<small style='color:" + s[1] + "'>" + escapeHtml(s[0]) + "</small>" + buttons + "</div>";
    });

    return html + "</div>";
  };

  // Load every schedule for the orders on screen
  window.loadInstallments = async function (orders) {
    instByOrder = {};

    if (orders.length > 0) {
      const ids = orders.map(function (o) {
        return o.id;
      }).join(",");

      const res = await fetch(
        SUPABASE_URL + "/rest/v1/installments?select=*&order_id=in.(" + ids +
        ")&order=order_id.desc,item_index.asc,seq.asc",
        { headers: authHeaders() }
      );

      if (expired(res)) return;
      if (res.ok) {
        const rows = await res.json();
        rows.forEach(function (r) {
          if (!instByOrder[r.order_id]) instByOrder[r.order_id] = [];
          instByOrder[r.order_id].push(r);
        });
      }
    }

    loadOverdue();
  };

  // ---------- Overdue list ----------
  function overduePanel() {
    let panel = document.getElementById("overdue-panel");
    if (panel) return panel;

    const ordersPanel = document.getElementById("orders-admin").closest("section");
    panel = document.createElement("section");
    panel.className = "panel";
    panel.id = "overdue-panel";
    panel.innerHTML =
      "<h2>Overdue installments</h2>" +
      "<p class='hint'>Unpaid after the extension (2 days weekly, 3 days monthly).</p>" +
      "<div id='overdue-list'>Loading...</div>";
    ordersPanel.parentNode.insertBefore(panel, ordersPanel);
    return panel;
  }

  async function loadOverdue() {
    overduePanel();
    const list = document.getElementById("overdue-list");
    const today = lagosToday();

    const res = await fetch(
      SUPABASE_URL + "/rest/v1/installments" +
      "?select=*,orders!inner(reference,customer_name,phone,email,status)" +
      "&orders.status=eq.payment_verified" +
      "&status=in.(pending,rejected)" +
      "&grace_until=lt." + today +
      "&order=grace_until.asc&limit=100",
      { headers: authHeaders() }
    );

    if (expired(res)) return;
    if (!res.ok) {
      list.textContent = "Could not load overdue payments (" + res.status + ").";
      return;
    }

    const rows = await res.json();
    if (rows.length === 0) {
      list.innerHTML = "<p class='hint'>No overdue payments.</p>";
      return;
    }

    list.innerHTML = rows.map(function (r) {
      const o = r.orders || {};
      const days = Math.max(0, Math.floor((Date.parse(today) - Date.parse(r.grace_until)) / 86400000));

      const subject = "Installment payment reminder - " + (o.reference || "");
      const body =
        "Hello " + (o.customer_name || "") + ",\n\n" +
        "This is a reminder that installment payment " + r.seq + " of " + r.total_count +
        " (" + naira(r.amount) + ") for " + r.item_name + " was due on " + r.due_date + ". " +
        "Please pay and upload your receipt on the Your orders page, or reply to this email if you need help.\n\n" +
        "Thank you,\nJao Lab Fashion & Styles";

      const mail = o.email
        ? "<a class='mini' href='mailto:" + escapeHtml(o.email) + "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body) + "'>Email reminder</a> "
        : "<small>No email on this order</small> ";

      return (
        "<div class='ia-ov'><strong>" + escapeHtml(o.customer_name || "Customer") + "</strong> · " +
        escapeHtml(o.reference || "") + "<br>" +
        escapeHtml(r.item_name) + ": payment " + r.seq + " of " + r.total_count +
        " · " + naira(r.amount) + "<br>" +
        "<small>Was due " + r.due_date + " · " + days + (days === 1 ? " day" : " days") + " overdue</small><br>" +
        mail + "<a class='mini' href='tel:" + escapeHtml(o.phone || "") + "'>Call</a></div>"
      );
    }).join("");
  }

  // ---------- Buttons ----------
  async function patchInstallment(id, body) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/installments?id=eq." + id, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify(body)
    });
    if (expired(res)) return false;
    if (!res.ok) {
      alert("Could not update the payment (" + res.status + ").");
      return false;
    }
    return true;
  }

  async function showReceipt(row) {
    const holder = document.getElementById("ireceipt-" + row.id);
    if (!row.receipt_path) {
      holder.textContent = "No receipt uploaded.";
      return;
    }

    holder.textContent = "Opening receipt...";
    const res = await fetch(
      SUPABASE_URL + "/storage/v1/object/sign/receipts/" + encodeURIComponent(row.receipt_path),
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
    holder.innerHTML = "<a class='mini' target='_blank' rel='noopener' href='" +
      SUPABASE_URL + "/storage/v1" + data.signedURL + "'>Tap to open receipt (valid 5 minutes)</a>";
  }

  document.addEventListener("click", async function (event) {
    const btn = event.target.closest("button[data-iact]");
    if (!btn) return;

    const id = Number(btn.getAttribute("data-iid"));
    const act = btn.getAttribute("data-iact");

    let row = null;
    Object.keys(instByOrder).forEach(function (key) {
      instByOrder[key].forEach(function (r) {
        if (r.id === id) row = r;
      });
    });
    if (!row) return;

    if (act === "receipt") {
      showReceipt(row);
    }

    if (act === "verify") {
      const ok = confirm(
        "Verify payment " + row.seq + " of " + row.total_count + " (" + naira(row.amount) + ")?\n\n" +
        "Check the receipt really shows this amount sent to your account."
      );
      if (!ok) return;
      if (await patchInstallment(id, { status: "verified", verified_at: new Date().toISOString(), admin_note: null })) {
        loadOrders();
      }
    }

    if (act === "reject") {
      const reason = prompt("Why is this receipt rejected? (the customer will see this)");
      if (reason === null) return;
      if (await patchInstallment(id, { status: "rejected", admin_note: reason.trim() || null })) {
        loadOrders();
      }
    }
  });
})();