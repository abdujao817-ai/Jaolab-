// Saves the order and the payment receipt to Supabase
(function () {
  const placeButton = document.getElementById("place-order");
  if (!placeButton) return;

  function publicHeaders(extra) {
    const headers = { apikey: SUPABASE_KEY };
    if (SUPABASE_KEY.indexOf("eyJ") === 0) {
      headers.Authorization = "Bearer " + SUPABASE_KEY;
    }
    for (const key in extra) {
      headers[key] = extra[key];
    }
    return headers;
  }

  placeButton.onclick = async function () {
    const name = document.getElementById("full-name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();
    const state = document.getElementById("state").value;
    const notes = document.getElementById("notes").value.trim();
    const receipt = document.getElementById("receipt").files[0];
    const error = document.getElementById("error-msg");

    error.textContent = "";

    if (!name || !phone || !address || !state) {
      error.textContent = "Please fill in your name, phone, address and state.";
      return;
    }
    if (!receipt) {
      error.textContent = "Please upload your payment receipt.";
      return;
    }
    if (receipt.size > 5 * 1024 * 1024) {
      error.textContent = "Your receipt is bigger than 5 MB. Please upload a smaller image or PDF.";
      return;
    }

    const info = calcCheckout();
    if (info.cart.length === 0) {
      error.textContent = "Your cart is empty.";
      return;
    }

    const payNow = info.dueNow + deliveryFee;
    const reference = "JL" + Date.now();
    const type = receipt.type || "image/jpeg";
    const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = reference + "." + ext;

    const items = info.cart.map(function (item) {
      const p = findProduct(item.id);
      return {
        id: item.id,
        name: p ? p.name : "Unknown item",
        price: p ? p.price : 0,
        qty: item.qty,
        mode: item.mode,
        frequency: item.frequency || null,
        count: item.count || null
      };
    });

    placeButton.disabled = true;
    placeButton.textContent = "Placing order...";

    try {
      // 1. Upload the receipt (private storage)
      const up = await fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + path, {
        method: "POST",
        headers: publicHeaders({ "Content-Type": type }),
        body: receipt
      });
      if (!up.ok) {
        throw new Error("Receipt upload failed (" + up.status + ")");
      }

      // 2. Save the order
      const res = await fetch(SUPABASE_URL + "/rest/v1/orders", {
        method: "POST",
        headers: publicHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({
          reference: reference,
          customer_name: name,
          phone: phone,
          email: email || null,
          state: state,
          address: address,
          notes: notes || null,
          items: items,
          items_total: info.itemsTotal,
          delivery_fee: deliveryFee,
          pay_now: payNow,
          receipt_path: path
        })
      });
      if (!res.ok) {
        throw new Error("Could not save the order (" + res.status + ")");
      }

      // 3. Keep a copy on this phone for the My orders page
      let orders = [];
      try {
        orders = JSON.parse(localStorage.getItem("jaolabOrders")) || [];
      } catch (e) {
        orders = [];
      }
      orders.push({
        ref: reference,
        date: new Date().toLocaleString(),
        items: info.cart,
        payNow: payNow,
        status: "Awaiting payment verification"
      });
      localStorage.setItem("jaolabOrders", JSON.stringify(orders));
      saveCart([]);

      document.getElementById("checkout-page").innerHTML =
        "<div class='success'>" +
        "<div class='tick'>✓</div>" +
        "<h2>Order received</h2>" +
        "<p>Your order reference</p>" +
        "<p class='ref'>" + reference + "</p>" +
        "<p class='note'>We will check your payment and update your order. Payment is not confirmed until it is verified.</p>" +
        "<a href='index.html' class='btn-orange'>Continue shopping</a>" +
        "</div>";
    } catch (e) {
      error.textContent = e.message + ". Your order was not placed. Please try again.";
      placeButton.disabled = false;
      placeButton.textContent = "Place order";
    }
  };
})();