// ================= ADMIN: delivery fees =================
(function () {
  const STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
    "Taraba", "Yobe", "Zamfara"
  ];

  const style = document.createElement("style");
  style.textContent =
    ".dl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #333}" +
    ".dl-row input{width:130px;height:42px;background:#222;color:#fff;border:1px solid #444;border-radius:10px;padding:0 10px;font-size:15px}" +
    ".dl-top input{width:100%;height:46px;background:#222;color:#fff;border:1px solid #444;border-radius:10px;padding:0 12px;font-size:16px;margin-bottom:12px}" +
    ".dl-top label{display:block;color:#aaa;font-size:13px;margin-bottom:5px}";
  document.head.appendChild(style);

  function panel() {
    let p = document.getElementById("delivery-panel");
    if (p) return p;

    const ordersPanel = document.getElementById("orders-admin").closest("section");
    p = document.createElement("section");
    p.className = "panel";
    p.id = "delivery-panel";
    p.innerHTML =
      "<h2>Delivery fees</h2>" +
      "<p class='hint'>Leave a state empty to use the default fee. A fee of 0 means free delivery.</p>" +
      "<div id='delivery-form'>Loading...</div>";
    ordersPanel.parentNode.insertBefore(p, ordersPanel);
    return p;
  }

  window.loadDeliveryAdmin = async function () {
    panel();
    const form = document.getElementById("delivery-form");

    const results = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/delivery_zones?select=state,fee", { headers: authHeaders() }),
      fetch(SUPABASE_URL + "/rest/v1/delivery_settings?select=*&id=eq.1", { headers: authHeaders() })
    ]);

    if (expired(results[0])) return;
    if (!results[0].ok || !results[1].ok) {
      form.textContent = "Could not load delivery fees (" + results[0].status + ").";
      return;
    }

    const zones = {};
    (await results[0].json()).forEach(function (r) {
      zones[r.state] = r.fee;
    });
    const s = (await results[1].json())[0] || { default_fee: 0, free_over: null };

    form.innerHTML =
      "<div class='dl-top'>" +
      "<label>Default fee (₦)</label><input type='number' id='dl-default' min='0' inputmode='numeric' value='" + s.default_fee + "'>" +
      "<label>Free delivery on orders of (₦), empty = never</label><input type='number' id='dl-free' min='1' inputmode='numeric' value='" + (s.free_over == null ? "" : s.free_over) + "'>" +
      "</div>" +
      STATES.map(function (st) {
        return "<div class='dl-row'><span>" + st + "</span><input type='number' min='0' inputmode='numeric' data-dl='" + st + "' placeholder='default' value='" + (zones[st] === undefined ? "" : zones[st]) + "'></div>";
      }).join("") +
      "<p class='error' id='dl-msg'></p>" +
      "<button class='start-plan' id='dl-save'>Save delivery fees</button>";

    document.getElementById("dl-save").onclick = saveAll;
  };

  async function saveAll() {
    const msg = document.getElementById("dl-msg");
    const btn = document.getElementById("dl-save");

    const def = Math.max(0, Math.round(Number(document.getElementById("dl-default").value || 0)));
    const freeText = document.getElementById("dl-free").value;
    const free = freeText === "" ? null : Math.max(1, Math.round(Number(freeText)));

    const set = [];
    const clear = [];
    document.querySelectorAll("[data-dl]").forEach(function (input) {
      const st = input.getAttribute("data-dl");
      if (input.value === "") {
        clear.push(st);
      } else {
        set.push({ state: st, fee: Math.max(0, Math.round(Number(input.value))) });
      }
    });

    btn.disabled = true;
    msg.style.color = "#4cd964";
    msg.textContent = "Saving...";

    try {
      let res = await fetch(SUPABASE_URL + "/rest/v1/delivery_settings?id=eq.1", {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ default_fee: def, free_over: free })
      });
      if (expired(res)) return;
      if (!res.ok) throw new Error("settings (" + res.status + ")");

      if (set.length) {
        res = await fetch(SUPABASE_URL + "/rest/v1/delivery_zones", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify(set)
        });
        if (!res.ok) throw new Error("fees (" + res.status + ")");
      }

      if (clear.length) {
        const list = clear.map(function (st) {
          return '"' + st + '"';
        }).join(",");
        res = await fetch(SUPABASE_URL + "/rest/v1/delivery_zones?state=in.(" + encodeURIComponent(list) + ")", {
          method: "DELETE",
          headers: authHeaders()
        });
        if (!res.ok) throw new Error("clearing (" + res.status + ")");
      }

      msg.textContent = "Saved ✓";
    } catch (e) {
      msg.style.color = "#ff5a5a";
      msg.textContent = "Could not save " + e.message;
    }

    btn.disabled = false;
  }
})();