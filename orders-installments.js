// ================= YOUR ORDERS: INSTALLMENT SCHEDULE AND ALERTS =================
(function () {
  let sched = {};
  let schedError = "";
  let flash = "";

  const style = document.createElement("style");
  style.textContent =
    ".ip-box{background:#222;border-radius:10px;padding:12px;margin:12px 0}" +
    ".ip-head{font-weight:bold;margin-bottom:8px}" +
    ".ip-next{color:#aaa;font-size:12px;margin-bottom:4px}" +
    ".ip-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #333}" +
    ".ip-row small{display:block;margin-top:3px;font-size:13px}" +
    ".ip-ok{color:#6fcf73}.ip-wait{color:#ffb066}.ip-bad{color:#ff7a7a}.ip-mute{color:#aaa}" +
    ".ip-up{background:#ff6a00;color:#fff;font-weight:bold;border-radius:20px;padding:9px 14px;font-size:14px;white-space:nowrap}" +
    ".ip-item{margin-top:12px;color:#ccc;font-size:14px}" +
    ".ip-alert{margin:12px;background:#3a1414;border:1px solid #c0392b;color:#ff9a9a;border-radius:10px;padding:12px;font-size:14px;line-height:1.5}" +
    ".ip-note{color:#ffb066;font-size:13px}";
  document.head.appendChild(style);

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "₦" + Number(n).toLocaleString();
  }

  function fmtD(d) {
    const t = new Date(d + "T00:00:00");
    return isNaN(t) ? String(d) : t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

  function isInstallmentOrder(o) {
    return (o.items || []).some(function (i) {
      return i.mode === "installment";
    });
  }

  function stage(r) {
    if (r.status === "verified") return { text: "Paid ✓", tone: "ok" };
    if (r.status === "submitted") return { text: "Receipt submitted · we're checking it", tone: "wait" };
    if (r.status === "rejected") {
      return {
        text: r.seq === 1
          ? "Your first payment was not accepted. Please email us."
          : "Receipt not accepted" + (r.admin_note ? ": " + r.admin_note : "") + " · please upload again",
        tone: "bad"
      };
    }
    if (!r.due_date) return { text: "Due date is set once your first payment is verified", tone: "mute" };
    if (r.phase === "due") return { text: "Due today", tone: "wait" };
    if (r.phase === "grace") return { text: "Past due · please pay by " + fmtD(r.grace_until), tone: "wait" };
    if (r.phase === "overdue") return { text: "Overdue · was due " + fmtD(r.due_date), tone: "bad" };
    return { text: "Due " + fmtD(r.due_date), tone: "mute" };
  }

  function canUpload(o, r) {
    return o.status === "payment_verified" && r.seq > 1 && r.due_date &&
      (r.status === "pending" || r.status === "rejected");
  }

  function payRow(o, r) {
    const s = stage(r);
    const upload = canUpload(o, r)
      ? "<label class='ip-up'>Upload receipt<input type='file' hidden accept='image/*,application/pdf' data-up='" +
        esc(o.ref) + "|" + r.item_index + "|" + r.seq + "'></label>"
      : "";
    return (
      "<div class='ip-row'><div><div>Payment " + r.seq + " of " + r.total_count +
      " · <strong>" + money(r.amount) + "</strong></div>" +
      "<small class='ip-" + s.tone + "'>" + esc(s.text) + "</small></div>" + upload + "</div>"
    );
  }

  window.loadSchedule = async function (refs) {
    schedError = "";
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_installments", {
        method: "POST",
        headers: await Auth.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ refs: refs })
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const rows = await res.json();
      sched = {};
      rows.forEach(function (r) {
        if (!sched[r.reference]) sched[r.reference] = [];
        sched[r.reference].push(r);
      });
    } catch (e) {
      sched = {};
      schedError = e.message;
    }
  };

  window.installmentBlock = function (o, open) {
    if (!isInstallmentOrder(o)) return "";

    const rows = sched[o.ref];
    if (!rows || rows.length === 0) {
      return schedError
        ? "<p class='ip-note'>Couldn't load your payment schedule (error " + esc(schedError) + ").</p>"
        : "";
    }

    let next = null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status !== "verified") {
        next = rows[i];
        break;
      }
    }

    let html = "<div class='ip-box'><div class='ip-head'>Installment payments · <a href='installments.html' style='color:#ff6a00;font-size:13px;text-decoration:none'>View plans ›</a></div>";
    html += next
      ? "<div class='ip-next'>Next payment</div>" + payRow(o, next)
      : "<p class='ip-ok'>All payments are complete and verified.</p>";

    if (open) {
      let lastItem = -1;
      html += "<div class='ip-all'>";
      rows.forEach(function (r) {
        if (r.item_index !== lastItem) {
          lastItem = r.item_index;
          html += "<div class='ip-item'>" + esc(r.item_name) + " · " + esc(r.frequency) + "</div>";
        }
        html += payRow(o, r);
      });
      html += "</div>";
    }

    return html + "</div>";
  };

  window.installmentAlert = function (list) {
    let html = "";
    if (flash) {
      html += "<p class='oc-notice'>" + esc(flash) + "</p>";
    }

    let late = 0;
    list.forEach(function (o) {
      (sched[o.ref] || []).forEach(function (r) {
        if (o.status === "payment_verified" && r.phase === "overdue" &&
            (r.status === "pending" || r.status === "rejected")) {
          late++;
        }
      });
    });

    if (late > 0) {
      html += "<div class='ip-alert'><strong>" + late + " overdue installment payment" +
        (late === 1 ? "" : "s") + "</strong><br>Please upload your receipt below so your order can continue.</div>";
    }
    return html;
  };

  async function uploadPayment(ref, item, seq, file) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("That file is bigger than 5 MB.");
    }

    const type = file.type || "image/jpeg";
    const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = ref + "-i" + item + "-" + seq + "-" + Date.now() + "." + ext;

    const up = await fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + path, {
      method: "POST",
      headers: await Auth.headers({ "Content-Type": type }),
      body: file
    });
    if (!up.ok) {
      throw new Error("Upload failed (" + up.status + ").");
    }

    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/submit_installment", {
      method: "POST",
      headers: hdr({ "Content-Type": "application/json" }),
      body: JSON.stringify({ p_ref: ref, p_item: item, p_seq: seq, p_path: path })
    });
    if (!res.ok) {
      throw new Error("Could not submit the receipt (" + res.status + ").");
    }
    if (!(await res.json())) {
      throw new Error("This payment can't be submitted right now.");
    }
  }

  document.addEventListener("change", async function (event) {
    const input = event.target;
    if (!input.matches || !input.matches("[data-up]")) return;

    const file = input.files && input.files[0];
    if (!file) return;

    const parts = input.getAttribute("data-up").split("|");
    const label = input.closest("label");
    if (label && label.firstChild) {
      label.firstChild.textContent = "Uploading...";
    }

    flash = "";
    try {
      await uploadPayment(parts[0], Number(parts[1]), Number(parts[2]), file);
      flash = "Receipt submitted. We will verify it soon.";
    } catch (e) {
      flash = e.message;
    }

    if (window.refreshOrders) {
      window.refreshOrders();
    }
  });
})();