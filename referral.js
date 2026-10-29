// ================= REFERRAL DISCOUNT ON THE CHECKOUT PAGE =================
(async function () {
  window.referralDiscount = 0;

  if (typeof Auth === "undefined" || !document.getElementById("order-summary")) return;
  if (!Auth.user()) return;

  try {
    const headers = await Auth.headers();

    const results = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/referral_settings?select=*&id=eq.1", { headers: headers }),
      fetch(
        SUPABASE_URL + "/rest/v1/referral_credits?select=id,amount&status=eq.available&order=created_at.asc,id.asc",
        { headers: headers }
      )
    ]);
    if (!results[0].ok || !results[1].ok) return;

    const settings = (await results[0].json())[0];
    const credits = await results[1].json();
    if (!settings || !settings.enabled || credits.length === 0) return;

    const payEl = document.querySelector(".sum-pay span:last-child");
    if (!payEl) return;
    const row = payEl.parentElement;

    const info = calcCheckout();
    const gross = info.dueNow + deliveryFee;

    const available = credits.reduce(function (sum, c) {
      return sum + c.amount;
    }, 0);

    // Not enough in the basket yet: tell the customer
    if (info.itemsTotal < settings.min_order) {
      const note = document.createElement("p");
      note.className = "note";
      note.style.color = "#ffb066";
      note.textContent = "You have " + formatPrice(available) + " referral credit. It applies to orders of " +
        formatPrice(settings.min_order) + " or more.";
      row.parentNode.insertBefore(note, row.nextSibling);
      return;
    }

    // Use whole credits, oldest first, never more than the amount payable
    let remaining = Math.min(gross, info.itemsTotal);
    let discount = 0;
    credits.forEach(function (c) {
      if (c.amount <= remaining) {
        discount += c.amount;
        remaining -= c.amount;
      }
    });
    if (discount <= 0) return;

    const line = document.createElement("div");
    line.className = "sum-line";
    line.innerHTML = "<span>Referral discount</span><span style='color:#4cd964'>−" + formatPrice(discount) + "</span>";
    row.parentNode.insertBefore(line, row);


    window.referralDiscount = discount;
    if (window.refreshTotals) window.refreshTotals();
  } catch (e) {}
})();