// ================= CHECKOUT: delivery fee by state =================
(function () {
  const stateSelect = document.getElementById("state");
  if (!document.getElementById("order-summary") || !stateSelect) return;

  window.deliveryFeeNow = 0;

  let zones = {};
  let settings = { default_fee: 0, free_over: null };
  let lastState = null;

  function lineFor(label) {
    const lines = document.querySelectorAll("#order-summary .sum-line");
    for (let i = 0; i < lines.length; i++) {
      const first = lines[i].firstElementChild;
      if (first && first.textContent.trim() === label) return lines[i];
    }
    return null;
  }

  function note() {
    let n = document.getElementById("del-note");
    if (!n) {
      const row = lineFor("Delivery fee");
      if (!row) return null;
      n = document.createElement("p");
      n.id = "del-note";
      n.className = "note";
      n.style.margin = "4px 0 8px";
      row.insertAdjacentElement("afterend", n);
    }
    return n;
  }

  // Draws the delivery line and the totals (also used by the referral discount)
  window.refreshTotals = function () {
    const info = calcCheckout();
    const state = stateSelect.value;
    const fee = window.deliveryFeeNow || 0;
    const discount = window.referralDiscount || 0;
    const total = info.dueNow + fee - discount;

    const feeRow = lineFor("Delivery fee");
    if (feeRow) {
      feeRow.lastElementChild.textContent = !state ? "Choose your state" : fee === 0 ? "Free" : formatPrice(fee);
    }

    const pay = document.querySelector(".sum-pay span:last-child");
    if (pay) pay.textContent = formatPrice(total);

    const strongs = document.querySelectorAll("#bank-details strong");
    if (strongs.length) strongs[strongs.length - 1].textContent = formatPrice(total);

    const n = note();
    if (n) {
      if (state && settings.free_over !== null && info.itemsTotal < settings.free_over) {
        n.textContent = "Spend " + formatPrice(settings.free_over - info.itemsTotal) + " more for free delivery.";
      } else if (state && settings.free_over !== null && info.itemsTotal >= settings.free_over) {
        n.textContent = "You get free delivery on this order.";
      } else {
        n.textContent = "";
      }
    }
  };

  function recompute() {
    const state = stateSelect.value;
    const info = calcCheckout();
    let fee = 0;

    if (state) {
      fee = zones[state] !== undefined ? zones[state] : settings.default_fee;
      if (settings.free_over !== null && info.itemsTotal >= settings.free_over) fee = 0;
    }

    window.deliveryFeeNow = fee;
    window.refreshTotals();
  }

  function check() {
    if (stateSelect.value !== lastState) {
      lastState = stateSelect.value;
      recompute();
    }
  }

  async function load() {
    try {
      const headers = typeof Auth !== "undefined" ? await Auth.headers() : { apikey: SUPABASE_KEY };
      const results = await Promise.all([
        fetch(SUPABASE_URL + "/rest/v1/delivery_zones?select=state,fee", { headers: headers }),
        fetch(SUPABASE_URL + "/rest/v1/delivery_settings?select=*&id=eq.1", { headers: headers })
      ]);

      if (results[0].ok) {
        const rows = await results[0].json();
        rows.forEach(function (r) {
          zones[r.state] = r.fee;
        });
      }
      if (results[1].ok) {
        const s = (await results[1].json())[0];
        if (s) settings = s;
      }
    } catch (e) {}

    lastState = null;
    check();
  }

  stateSelect.addEventListener("change", check);
  setInterval(check, 400);
  load();
})();