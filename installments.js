// ================= MY INSTALLMENTS: plans, progress and payments =================
(function () {
  const root = document.getElementById("pl-root");
  if (!root) return;

  if (typeof Auth === "undefined" || !Auth.user()) {
    window.location.replace("login.html?next=installments.html");
    return;
  }

  const user = Auth.user();
  const state = { tab: "progress", q: "", openKey: "", track: false };
  let plans = [];
  let orderDone = {};
  let paying = null;
  let lastKey = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function today() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  }

  function fmtD(d) {
    const t = new Date(d + "T00:00:00");
    return isNaN(t) ? String(d) : t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtLong(d) {
    const t = new Date(d);
    return isNaN(t) ? "" : t.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  function daysFromToday(d) {
    return Math.round((Date.parse(d) - Date.parse(today())) / 86400000);
  }

  function inDays(d) {
    const n = daysFromToday(d);
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n > 1) return "in " + n + " days";
    return Math.abs(n) + (n === -1 ? " day" : " days") + " ago";
  }

  function sum(list) {
    return list.reduce(function (n, r) {
      return n + r.amount;
    }, 0);
  }

  // ---------- Page skeleton ----------
  root.innerHTML =
    "<div id='pl-flash'></div>" +
    "<div id='pl-list-view'>" +
    "<div class='pl-tabs' id='pl-tabs'></div>" +
    "<div class='pl-search'><svg viewBox='0 0 24 24'><circle cx='11' cy='11' r='7'/><path d='M21 21l-4.3-4.3'/></svg>" +
    "<input type='text' id='pl-q' placeholder='Search your installments'></div>" +
    "<div id='pl-list'></div>" +
    "</div>" +
    "<div id='pl-detail' style='display:none'></div>";

  const banner = document.createElement("div");
  banner.id = "pl-banner";
  document.body.appendChild(banner);

  function flash(text, isError) {
    $("pl-flash").innerHTML = text ? "<p class='" + (isError ? "err" : "") + "'>" + esc(text) + "</p>" : "";
  }

  // ---------- Working out each plan ----------
  function health(p) {
    if (p.cancelled) {
      return { cls: "bad", label: p.order.status === "cancelled" ? "Cancelled" : "Payment not verified" };
    }
    if (p.completed) return { cls: "ok", label: "Completed" };
    if (p.order.status === "awaiting_verification") return { cls: "wait", label: "Awaiting verification" };

    const open = p.rows.filter(function (r) {
      return r.status === "pending" || r.status === "rejected";
    });
    if (open.some(function (r) { return r.phase === "overdue"; })) return { cls: "bad", label: "Overdue" };
    if (open.some(function (r) { return r.phase === "due" || r.phase === "grace"; })) return { cls: "wait", label: "Payment due" };
    if (p.rows.some(function (r) { return r.status === "submitted" && r.seq > 1; })) return { cls: "wait", label: "Checking payment" };
    return { cls: "ok", label: "On track" };
  }

  function stageText(p) {
    const s = p.order.status;
    if (p.order.status === "cancelled") return { cls: "bad", text: "Order cancelled" };
    if (s === "payment_rejected") return { cls: "bad", text: "Your first payment could not be verified" };
    if (s === "awaiting_verification") return { cls: "wait", text: "Waiting for your first payment to be verified" };
    if (s === "delivered") return { cls: "ok", text: "Delivered" };
    if (s === "dispatched") return { cls: "ok", text: "Dispatched" };
    if (s === "processing") return { cls: "ok", text: "Processing your order" };
    if (!orderDone[p.ref]) return { cls: "wait", text: "Paying in installments. Your item is delivered after the final payment." };
    return { cls: "ok", text: "All payments complete. We are preparing your order." };
  }

  function build(orders, rows) {
    const byRef = {};
    orders.forEach(function (o) {
      byRef[o.reference] = o;
    });

    const groups = {};
    const perOrder = {};
    rows.forEach(function (r) {
      const k = r.reference + "|" + r.item_index;
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
      if (!perOrder[r.reference]) perOrder[r.reference] = [];
      perOrder[r.reference].push(r);
    });

    orderDone = {};
    Object.keys(perOrder).forEach(function (ref) {
      orderDone[ref] = perOrder[ref].every(function (r) {
        return r.status === "verified";
      });
    });

    const t = today();

    plans = Object.keys(groups).map(function (k) {
      const list = groups[k].slice().sort(function (a, b) {
        return a.seq - b.seq;
      });
      const first = list[0];
      const order = byRef[first.reference];
      if (!order) return null;

      const item = (order.items || [])[first.item_index] || {};
      const verified = list.filter(function (r) { return r.status === "verified"; });
      const cancelled = order.status === "cancelled" || order.status === "payment_rejected";

      const p = {
        key: first.reference + "-" + first.item_index,
        ref: first.reference,
        idx: first.item_index,
        name: first.item_name,
        frequency: first.frequency,
        total: first.total_count,
        rows: list,
        order: order,
        product: item.id ? findProduct(item.id) : null,
        paidCount: verified.length,
        paidAmount: sum(verified),
        totalAmount: sum(list),
        ought: sum(list.filter(function (r) {
          return r.seq === 1 || (r.due_date && r.due_date <= t);
        })),
        next: list.find(function (r) { return r.status !== "verified"; }) || null,
        cancelled: cancelled,
        completed: !cancelled && verified.length === list.length
      };
      p.bucket = p.cancelled ? "cancelled" : p.completed ? "completed" : "progress";
      p.pct = p.totalAmount ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0;
      return p;
    }).filter(Boolean);

    plans.sort(function (a, b) {
      return String(b.order.created_at).localeCompare(String(a.order.created_at));
    });
  }

  function unit(p) {
    return p.frequency === "Weekly" ? "week" : "month";
  }

  function canPay(p) {
    const n = p.next;
    return !!(p.order.status === "payment_verified" && n && n.seq > 1 && n.due_date &&
      (n.status === "pending" || n.status === "rejected"));
  }

  function whyNot(p) {
    if (p.completed) return "All payments are complete.";
    if (p.cancelled) return "This plan is closed.";
    if (p.order.status === "awaiting_verification") return "You can pay the next installment after your first payment is verified.";
    const n = p.next;
    if (n && n.status === "submitted") return "Your last receipt is being checked.";
    if (n && !n.due_date) return "Your payment dates are set once your first payment is verified.";
    return "";
  }

  // ---------- List view ----------
  function statusLine(p) {
    if (p.cancelled) return p.order.status === "cancelled" ? "This order was cancelled" : "First payment not verified";
    if (p.completed) return "All payments verified";
    if (p.order.status === "awaiting_verification") return "Waiting for your first payment to be verified";
    const n = p.next;
    if (n && n.status === "submitted") return "Receipt submitted · being checked";
    if (n && n.due_date) return "Next: " + formatPrice(n.amount) + " · due " + fmtD(n.due_date);
    return "";
  }

  function drawTabs() {
    const names = { progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
    $("pl-tabs").innerHTML = ["progress", "completed", "cancelled"].map(function (t) {
      const n = plans.filter(function (p) { return p.bucket === t; }).length;
      return "<button class='pl-tab" + (state.tab === t ? " on" : "") + "' data-tab='" + t + "'>" + names[t] + " <b>" + n + "</b></button>";
    }).join("");
  }

  function drawList() {
    drawTabs();
    const q = state.q;
    const shown = plans.filter(function (p) {
      return p.bucket === state.tab && (!q || (p.name + " " + p.ref).toLowerCase().indexOf(q) !== -1);
    });

    if (shown.length === 0) {
      $("pl-list").innerHTML = "<div class='pl-empty'>" +
        (plans.length === 0
          ? "You have no installment plans yet.<br>Choose Weekly or Monthly on any product to start one."
          : "No plans here.") + "</div>";
      return;
    }

    $("pl-list").innerHTML = shown.map(function (p) {
      const h = health(p);
      return (
        "<div class='pl-card " + h.cls + "' data-open='" + esc(p.key) + "'>" +
        "<div class='pl-card-top'><span>" + esc(fmtLong(p.order.created_at)) + "</span>" +
        "<span class='pl-chip " + h.cls + "'>" + h.label + "</span></div>" +
        "<div class='pl-body'><div class='pl-thumb' style=\"" + photoStyle(p.product) + "\"></div>" +
        "<div class='pl-info'><p class='pl-name'>" + esc(p.name) + "</p>" +
        "<p class='pl-amt'><strong>" + formatPrice(p.paidAmount) + "</strong> of " + formatPrice(p.totalAmount) + "</p>" +
        "<div class='pl-prog'><span>Payment (" + p.paidCount + "/" + p.rows.length + ")</span><span>" + p.pct + "%</span></div>" +
        "<div class='pl-bar'><i style='width:" + p.pct + "%'></i></div>" +
        "<p class='pl-sub'>" + esc(statusLine(p)) + "</p></div></div></div>"
      );
    }).join("");
  }

  function drawBanner() {
    let best = null;
    plans.forEach(function (p) {
      if (p.bucket !== "progress" || p.order.status !== "payment_verified") return;
      p.rows.forEach(function (r) {
        if ((r.status === "pending" || r.status === "rejected") && r.due_date) {
          if (!best || r.due_date < best.row.due_date) best = { plan: p, row: r };
        }
      });
    });

    if (!best || state.openKey) {
      banner.style.display = "none";
      return;
    }

    const n = daysFromToday(best.row.due_date);
    const late = n < 0;
    banner.setAttribute("data-bannerkey", best.plan.key);
    banner.innerHTML =
      "<div style='flex:1'><strong>" + formatPrice(best.row.amount) + "</strong>" +
      "<small>" + (late ? "Overdue since " + fmtD(best.row.due_date) : "Due " + inDays(best.row.due_date)) + " · " + esc(best.plan.name) + "</small></div>" +
      "<span style='color:#ff6a00;font-size:22px'>›</span>";
    banner.style.display = "flex";
  }

  // ---------- Detail view ----------
  function kv(label, value, plain) {
    return "<div class='pl-kv" + (plain ? " plain" : "") + "'><span>" + label + "</span><span>" + value + "</span></div>";
  }

  function rowStage(r, p) {
    if (r.status === "verified") return { cls: "pl-ok", text: "Paid ✓" };
    if (r.status === "submitted") return { cls: "pl-wait", text: "Receipt submitted · being checked" };
    if (r.status === "rejected") {
      return { cls: "pl-bad", text: "Receipt not accepted" + (r.admin_note ? ": " + r.admin_note : "") };
    }
    if (!r.due_date) return { cls: "pl-mute", text: "Date set after your first payment is verified" };
    if (r.phase === "due") return { cls: "pl-wait", text: "Due today" };
    if (r.phase === "grace") return { cls: "pl-wait", text: "Past due · pay by " + fmtD(r.grace_until) };
    if (r.phase === "overdue") return { cls: "pl-bad", text: "Overdue · was due " + fmtD(r.due_date) };
    return { cls: "pl-mute", text: "Due " + fmtD(r.due_date) };
  }

  function timeline(p) {
    const s = p.order.status;
    const steps = [
      ["Order placed", true],
      ["First payment verified", ["payment_verified", "processing", "dispatched", "delivered"].indexOf(s) !== -1],
      ["All installments paid", !!orderDone[p.ref]],
      ["Processing", ["processing", "dispatched", "delivered"].indexOf(s) !== -1],
      ["Dispatched", ["dispatched", "delivered"].indexOf(s) !== -1],
      ["Delivered", s === "delivered"]
    ];
    return steps.map(function (st) {
      return "<div class='pl-step" + (st[1] ? " done" : "") + "'><i>" + (st[1] ? "✓" : "") + "</i>" + st[0] + "</div>";
    }).join("");
  }

  function drawDetail(p) {
    const h = health(p);
    const st = stageText(p);
    const o = p.order;
    const n = p.next;
    const pay = canPay(p);

    let due = "";
    if (!p.cancelled && !p.completed && n && n.due_date && (n.status === "pending" || n.status === "rejected")) {
      due = "<p class='pl-due'>Payment due: " + formatPrice(n.amount) + " (" + inDays(n.due_date) + ")</p>";
    }

    let nextText = "None";
    if (n) {
      nextText = formatPrice(n.amount) + (n.due_date ? " on " + fmtD(n.due_date) : "");
    }

    let sched = "";
    p.rows.forEach(function (r) {
      const rs = rowStage(r, p);
      sched += "<div class='pl-sched'>Payment " + r.seq + " of " + r.total_count + " · <strong>" + formatPrice(r.amount) + "</strong>" +
        "<small class='" + rs.cls + "'>" + esc(rs.text) + "</small></div>";
    });

    const issue =
      "mailto:" + STORE_EMAIL + "?subject=" + encodeURIComponent("Installment issue - " + p.ref) +
      "&body=" + encodeURIComponent("Order: " + p.ref + "\nItem: " + p.name + "\n\nPlease describe the problem:\n");

    $("pl-detail").innerHTML =
      "<div class='pl-hero'><div class='pl-herophoto' style=\"" + photoStyle(p.product) + "\"></div></div>" +
      "<p class='pl-tag'>ORDER " + esc(p.ref) + "</p>" +
      "<h2 class='pl-h2'>" + esc(p.name) + "</h2>" +
      "<div class='pl-detail-chip'><span class='pl-chip " + h.cls + "'>" + h.label + "</span></div>" +

      "<div class='pl-box'><h3>Current status</h3>" +
      "<p class='pl-stage " + st.cls + "'>" + esc(st.text) + "</p>" + due + "</div>" +

      "<div class='pl-box'><h3>Payment progress (" + p.paidCount + "/" + p.rows.length + ")</h3>" +
      "<div class='pl-prog'><span>" + formatPrice(p.paidAmount) + " of " + formatPrice(p.totalAmount) + "</span><span>" + p.pct + "%</span></div>" +
      "<div class='pl-bar'><i style='width:" + p.pct + "%'></i></div></div>" +

      "<div class='pl-box'><h3>Plan breakdown</h3>" +
      kv("Total amount", formatPrice(p.totalAmount)) +
      kv("Amount paid", formatPrice(p.paidAmount)) +
      kv("Should have been paid by now", formatPrice(p.ought)) +
      kv("Payment frequency", esc(p.frequency)) +
      kv("Payment duration", p.total + " " + unit(p) + "s") +
      kv("Next payment", n ? nextText : "None") + "</div>" +

      "<div class='pl-box'><h3>Delivery</h3>" +
      kv("Delivery address", esc(o.address || "") + (o.state ? ", " + esc(o.state) : ""), true) +
      kv("When", "After the final payment", true) + "</div>" +

      "<div class='pl-box'><h3>Charges</h3>" +
      kv("Delivery fee", o.delivery_fee ? formatPrice(o.delivery_fee) : "Free", true) +
      (o.discount ? kv("Referral discount", "−" + formatPrice(o.discount), true) : "") + "</div>" +

      "<div class='pl-box'><h3>Payment schedule</h3>" + sched + "</div>" +

      "<button class='pl-btn main' id='pl-pay'" + (pay ? "" : " disabled") + ">Pay next installment</button>" +
      (pay ? "" : "<p class='pl-note' style='margin-bottom:12px'>" + esc(whyNot(p)) + "</p>") +

      "<h4 class='pl-sec'>Other options</h4>" +
      "<button class='pl-btn' data-track='1'>" + (state.track ? "Hide order tracking" : "Track order") + "</button>" +
      (state.track ? "<div class='pl-box'>" + timeline(p) + "</div>" : "") +
      "<a class='pl-btn' href='" + issue + "'>Report an issue</a>";
  }

  // ---------- Payment sheet ----------
  function openSheet(p) {
    const row = p.next;
    if (!row || !canPay(p)) return;
    paying = { plan: p, row: row };

    const bank = typeof bankDetails !== "undefined" ? bankDetails : { bank: "", accountName: "", accountNumber: "" };

    $("pl-sheet-box").innerHTML =
      "<h3>Pay installment " + row.seq + " of " + row.total_count + "</h3>" +
      "<p class='pl-sub' style='margin:0'>" + esc(p.name) + "</p>" +
      "<p class='pl-big'>" + formatPrice(row.amount) + "</p>" +
      "<div class='pl-bank'>" +
      "<p><span>Bank</span><strong>" + esc(bank.bank) + "</strong></p>" +
      "<p><span>Account name</span><strong>" + esc(bank.accountName) + "</strong></p>" +
      "<p><span>Account number</span><strong>" + esc(bank.accountNumber) + "</strong></p>" +
      "<p><span>Amount to send</span><strong>" + formatPrice(row.amount) + "</strong></p></div>" +
      "<p class='pl-sub' style='margin:0 0 6px'>Send the exact amount, then upload your receipt.</p>" +
      "<input type='file' id='pl-file' accept='image/*,application/pdf'>" +
      "<p class='error' id='pl-pay-msg'></p>" +
      "<button class='pl-btn main' id='pl-send'>Submit receipt</button>" +
      "<button class='pl-btn' id='pl-cancel'>Cancel</button>";

    $("pl-sheet").classList.add("show");
  }

  function closeSheet() {
    $("pl-sheet").classList.remove("show");
    paying = null;
  }

  async function submitPayment() {
    if (!paying) return;
    const msg = $("pl-pay-msg");
    const file = $("pl-file").files[0];

    msg.style.color = "#ff5a5a";
    if (!file) {
      msg.textContent = "Please choose your payment receipt.";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      msg.textContent = "That file is bigger than 5 MB.";
      return;
    }

    const p = paying.plan;
    const row = paying.row;
    const type = file.type || "image/jpeg";
    const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = p.ref + "-i" + p.idx + "-" + row.seq + "-" + Date.now() + "." + ext;

    $("pl-send").disabled = true;
    msg.style.color = "#4cd964";
    msg.textContent = "Uploading...";

    try {
      const up = await fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + path, {
        method: "POST",
        headers: await Auth.headers({ "Content-Type": type }),
        body: file
      });
      if (!up.ok) throw new Error("Upload failed (" + up.status + ").");

      const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/submit_installment", {
        method: "POST",
        headers: await Auth.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ p_ref: p.ref, p_item: p.idx, p_seq: row.seq, p_path: path })
      });
      if (!res.ok) throw new Error("Could not submit the receipt (" + res.status + ").");
      if (!(await res.json())) throw new Error("This payment can't be submitted right now.");

      closeSheet();
      flash("Receipt submitted. We will verify it soon.", false);
      await load(false);
    } catch (e) {
      msg.style.color = "#ff5a5a";
      msg.textContent = e.message;
      $("pl-send").disabled = false;
    }
  }

  // ---------- Showing the right screen ----------
  function route() {
    const m = /^#plan=(.+)$/.exec(window.location.hash);
    state.openKey = m ? decodeURIComponent(m[1]) : "";
    const plan = plans.find(function (p) {
      return p.key === state.openKey;
    });
    const open = !!(state.openKey && plan);

    $("pl-list-view").style.display = open ? "none" : "block";
    $("pl-detail").style.display = open ? "block" : "none";
    $("pl-title").textContent = open ? plan.name : "My installments";

    if (open) {
      drawDetail(plan);
    } else {
      state.openKey = "";
      drawList();
    }
    drawBanner();

    if (lastKey !== state.openKey) {
      lastKey = state.openKey;
      state.track = false;
      if (open) drawDetail(plan);
      window.scrollTo(0, 0);
    }
  }

  // ---------- Loading ----------
  async function load(showLoading) {
    if (showLoading) {
      $("pl-list").innerHTML = "<p class='pl-note' style='padding:30px 14px'>Loading your plans...</p>";
    }

    try {
      const orderHeaders = await Auth.headers();
      const results = await Promise.all([
        fetch(
          SUPABASE_URL + "/rest/v1/orders?select=reference,status,items,items_total,delivery_fee,discount,pay_now,created_at,state,address" +
          "&user_id=eq." + user.id + "&order=created_at.desc&limit=100",
          { headers: orderHeaders }
        ),
        fetch(SUPABASE_URL + "/rest/v1/rpc/my_installments", {
          method: "POST",
          headers: await Auth.headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ refs: [] })
        })
      ]);

      if (results[0].status === 401 || results[1].status === 401) {
        await Auth.signOut();
        window.location.replace("login.html?next=installments.html");
        return;
      }
      if (!results[0].ok || !results[1].ok) {
        $("pl-list").innerHTML = "<div class='pl-empty'>Could not load your plans (error " +
          (results[0].ok ? results[1].status : results[0].status) + ").</div>";
        return;
      }

      build(await results[0].json(), await results[1].json());
    } catch (e) {
      $("pl-list").innerHTML = "<div class='pl-empty'>Could not load your plans. Check your connection and try again.</div>";
      return;
    }

    route();
  }

  // ---------- Taps ----------
  root.addEventListener("click", function (event) {
    const open = event.target.closest("[data-open]");
    if (open) {
      window.location.hash = "#plan=" + encodeURIComponent(open.getAttribute("data-open"));
      return;
    }

    const tab = event.target.closest("[data-tab]");
    if (tab) {
      state.tab = tab.getAttribute("data-tab");
      drawList();
      return;
    }

    if (event.target.closest("#pl-pay")) {
      const plan = plans.find(function (p) {
        return p.key === state.openKey;
      });
      if (plan) openSheet(plan);
      return;
    }

    if (event.target.closest("[data-track]")) {
      state.track = !state.track;
      const plan = plans.find(function (p) {
        return p.key === state.openKey;
      });
      if (plan) drawDetail(plan);
    }
  });

  banner.addEventListener("click", function () {
    const key = banner.getAttribute("data-bannerkey");
    if (key) window.location.hash = "#plan=" + encodeURIComponent(key);
  });

  $("pl-q").oninput = function () {
    state.q = $("pl-q").value.trim().toLowerCase();
    drawList();
  };

  $("pl-sheet").addEventListener("click", function (event) {
    if (event.target === $("pl-sheet") || event.target.closest("#pl-cancel")) closeSheet();
    if (event.target.closest("#pl-send")) submitPayment();
  });

  $("pl-back").onclick = function (event) {
    if (state.openKey) {
      event.preventDefault();
      window.location.hash = "";
    }
  };

  window.addEventListener("hashchange", route);

  load(true);
})();