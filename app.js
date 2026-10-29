// ================= SETTINGS (edit these) =================
const planOptions = {
  Weekly: { unit: "week", durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  Monthly: { unit: "month", durations: [2, 3, 4, 5, 6] }
};

const deliveryFee = 0; // placeholder until you decide your delivery fees

const bankDetails = {
  bank: "Add your bank name",
  accountName: "Add your account name",
  accountNumber: "Add your account number"
};

const STORE_EMAIL = "jaolabreviews817@gmail.com";

const nigerianStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

// ================= HELPERS =================
function formatPrice(amount) {
  return "₦" + Number(amount).toLocaleString();
}

function photoStyle(product) {
  if (product && product.image_url) {
    return "background-image:url('" + product.image_url + "');" +
           "background-size:contain;" +
           "background-repeat:no-repeat;" +
           "background-position:center;" +
           "background-color:#ffffff";
  }
  return "";
}

function findProduct(id) {
  for (let i = 0; i < products.length; i++) {
    if (products[i].id === id) {
      return products[i];
    }
  }
  return null;
}

// ================= CART STORAGE =================
function getCart() {
  try {
    return JSON.parse(localStorage.getItem("jaolabCart")) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("jaolabCart", JSON.stringify(cart));
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();

  if (item.mode === "once") {
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id === item.id && cart[i].mode === "once") {
        cart[i].qty += 1;
        saveCart(cart);
        return;
      }
    }
  }

  cart.push(item);
  saveCart(cart);
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  let total = 0;
  getCart().forEach(function (item) {
    total += item.qty;
  });

  badge.textContent = total;
  badge.style.display = total > 0 ? "flex" : "none";
}

// ================= HOME PAGE =================
const grid = document.getElementById("product-grid");
let currentCategory = "All";
let currentSearch = "";

function showProducts() {
  grid.innerHTML = "";
  let shown = 0;

  products.forEach(function (product) {
    const matchCategory = currentCategory === "All" || product.category === currentCategory;
    const matchSearch =
      product.name.toLowerCase().includes(currentSearch) ||
      product.category.toLowerCase().includes(currentSearch);

    if (matchCategory && matchSearch) {
      grid.innerHTML += `
        <a href="product.html?id=${product.id}" class="card">
          <div class="photo" style="${photoStyle(product)}"></div>
          <p class="name">${product.name}</p>
          <p class="price">${formatPrice(product.price)}</p>
        </a>
      `;
      shown++;
    }
  });

  if (shown === 0) {
    grid.innerHTML = "<p class='no-items'>No products found.</p>";
  }
}

if (grid) {
  showProducts();

  const tabs = document.querySelectorAll(".tabs a");
  tabs.forEach(function (tab) {
    tab.onclick = function (event) {
      event.preventDefault();
      tabs.forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      currentCategory = tab.getAttribute("data-category");
      showProducts();
    };
  });

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.oninput = function () {
      currentSearch = searchInput.value.trim().toLowerCase();
      showProducts();
    };
  }
}

// ================= PRODUCT PAGE =================
const productName = document.getElementById("product-name");

if (productName) {
  const params = new URLSearchParams(window.location.search);
  const product = findProduct(Number(params.get("id")));

  if (product) {
    document.getElementById("product-title").textContent = product.name;
    productName.textContent = product.name;
    document.getElementById("product-price").textContent = formatPrice(product.price);

    const bigPhoto = document.querySelector(".big-photo");
    if (bigPhoto && product.image_url) {
      bigPhoto.style.backgroundImage = "url('" + product.image_url + "')";
      bigPhoto.style.backgroundSize = "contain";
      bigPhoto.style.backgroundRepeat = "no-repeat";
      bigPhoto.style.backgroundPosition = "center";
      bigPhoto.style.backgroundColor = "#ffffff";
      bigPhoto.style.height = "340px";
    }
  } else {
    productName.textContent = "Product not found";
  }

  const buyOnce = document.getElementById("buy-once");
  if (buyOnce) {
    buyOnce.onclick = function () {
      if (!product) return;
      addToCart({ id: product.id, qty: 1, mode: "once" });
      window.location.href = "cart.html";
    };
  }

  const addCartButton = document.getElementById("add-cart");
  if (addCartButton) {
    addCartButton.onclick = function () {
      if (!product) return;
      addToCart({ id: product.id, qty: 1, mode: "once" });
      addCartButton.textContent = "Added ✓";
      setTimeout(function () {
        addCartButton.textContent = "Add to cart";
      }, 1500);
    };
  }

  const durationBox = document.getElementById("duration-options");
  const summary = document.getElementById("plan-summary");
  const startPlan = document.getElementById("start-plan");
  const frequencyButtons = document.querySelectorAll("[data-frequency]");

  let chosenFrequency = null;
  let chosenCount = null;

  frequencyButtons.forEach(function (button) {
    button.onclick = function () {
      chosenFrequency = button.getAttribute("data-frequency");
      chosenCount = null;
      const plan = planOptions[chosenFrequency];

      frequencyButtons.forEach(function (b) {
        b.classList.remove("selected");
      });
      button.classList.add("selected");

      summary.innerHTML = "";
      durationBox.innerHTML = "";
      if (startPlan) startPlan.style.display = "none";
      document.getElementById("step-title").textContent = "Select the number of installments";

      plan.durations.forEach(function (count) {
        const durationButton = document.createElement("button");
        durationButton.className = "plan-btn";
        durationButton.textContent = count;

        durationButton.onclick = function () {
          durationBox.querySelectorAll(".plan-btn").forEach(function (b) {
            b.classList.remove("selected");
          });
          durationButton.classList.add("selected");
          chosenCount = count;

          if (product) {
            const each = Math.ceil(product.price / count);
            summary.innerHTML =
              "<span class='pay-amount'>" + formatPrice(each) + "</span> <span>per " + plan.unit + "</span>" +
              "<p>for " + count + " " + plan.unit + "s · Total " + formatPrice(product.price) + "</p>";
          }
          if (startPlan) startPlan.style.display = "block";
        };

        durationBox.appendChild(durationButton);
      });
    };
  });

  if (startPlan) {
    startPlan.onclick = function () {
      if (!product || !chosenFrequency || !chosenCount) return;
      addToCart({
        id: product.id,
        qty: 1,
        mode: "installment",
        frequency: chosenFrequency,
        count: chosenCount
      });
      window.location.href = "cart.html";
    };
  }
}

// ================= CART PAGE =================
const cartBox = document.getElementById("cart-items");

function renderCart() {
  if (!cartBox) return;
  const cart = getCart();

  if (cart.length === 0) {
    cartBox.innerHTML = `
      <div class="empty">
        <p>Your cart is empty</p>
        <a href="index.html" class="btn-orange">Start shopping</a>
      </div>
    `;
    return;
  }

  let html = "";
  let total = 0;

  cart.forEach(function (item, index) {
    const p = findProduct(item.id);
    if (!p) return;

    const lineTotal = p.price * item.qty;
    total += lineTotal;

    let detail = "";
    let controls = "";

    if (item.mode === "installment") {
      const unit = planOptions[item.frequency].unit;
      const each = Math.ceil(p.price / item.count);
      detail = "<p class='plan-tag'>Installment: " + formatPrice(each) + " per " + unit +
               " for " + item.count + " " + unit + "s</p>";
    } else {
      detail = "<p class='plan-tag'>Pay once</p>";
      controls =
        "<div class='qty'>" +
        "<button onclick='changeQty(" + index + ", -1)'>−</button>" +
        "<span>" + item.qty + "</span>" +
        "<button onclick='changeQty(" + index + ", 1)'>+</button>" +
        "</div>";
    }

    html += `
      <div class="cart-item">
        <div class="cart-photo" style="${photoStyle(p)}"></div>
        <div class="cart-info">
          <p class="cart-name">${p.name}</p>
          ${detail}
          <p class="cart-price">${formatPrice(lineTotal)}</p>
          ${controls}
        </div>
        <button class="remove" onclick="removeItem(${index})">✕</button>
      </div>
    `;
  });

  html += `
    <div class="cart-total">
      <div class="total-row">
        <span>Total</span>
        <strong>${formatPrice(total)}</strong>
      </div>
      <p class="note">Items on an installment plan are delivered after the final payment.</p>
      <a href="checkout.html" class="btn-orange">Checkout</a>
    </div>
  `;

  cartBox.innerHTML = html;
}

function changeQty(index, change) {
  const cart = getCart();
  cart[index].qty += change;
  if (cart[index].qty < 1) {
    cart.splice(index, 1);
  }
  saveCart(cart);
  renderCart();
}

function removeItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

if (cartBox) {
  renderCart();
}
// ================= CHECKOUT PAGE =================
 const summaryBox = document.getElementById("order-summary");

function calcCheckout() {
  const cart = getCart();
  let itemsTotal = 0;
  let dueNow = 0;
  let lines = "";

  cart.forEach(function (item) {
    const p = findProduct(item.id);
    if (!p) return;

    itemsTotal += p.price * item.qty;

    if (item.mode === "installment") {
      const unit = planOptions[item.frequency].unit;
      const each = Math.ceil(p.price / item.count);
      dueNow += each;
      lines +=
        "<div class='sum-line'><span>" + p.name +
        "<small>Installment: " + formatPrice(each) + " per " + unit + " x " + item.count + "</small></span>" +
        "<span>" + formatPrice(p.price) + "</span></div>";
    } else {
      dueNow += p.price * item.qty;
      lines +=
        "<div class='sum-line'><span>" + p.name +
        "<small>Quantity: " + item.qty + " · Pay once</small></span>" +
        "<span>" + formatPrice(p.price * item.qty) + "</span></div>";
    }
  });

  return { cart: cart, itemsTotal: itemsTotal, dueNow: dueNow, lines: lines };
}

if (summaryBox) {
  const data = calcCheckout();

  if (data.cart.length === 0) {
    window.location.href = "cart.html";
  }

  const payNow = data.dueNow + deliveryFee;

  summaryBox.innerHTML =
    data.lines +
    "<div class='sum-line'><span>Items total</span><span>" + formatPrice(data.itemsTotal) + "</span></div>" +
    "<div class='sum-line'><span>Delivery fee</span><span>" + formatPrice(deliveryFee) + "</span></div>" +
    "<div class='sum-line sum-pay'><span>Pay now</span><span>" + formatPrice(payNow) + "</span></div>" +
    "<p class='note'>For installment items, the first installment is paid now and the rest follow the plan. They are delivered after the final payment.</p>";

  const stateSelect = document.getElementById("state");
  nigerianStates.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    stateSelect.appendChild(option);
  });

  document.getElementById("bank-details").innerHTML =
    "<p><span>Bank</span><strong>" + bankDetails.bank + "</strong></p>" +
    "<p><span>Account name</span><strong>" + bankDetails.accountName + "</strong></p>" +
    "<p><span>Account number</span><strong>" + bankDetails.accountNumber + "</strong></p>" +
    "<p><span>Amount to send</span><strong>" + formatPrice(payNow) + "</strong></p>";

  // Place order: saves the receipt and the order to Supabase
  document.getElementById("place-order").onclick = async function () {
    const placeButton = document.getElementById("place-order");
    const error = document.getElementById("error-msg");

    const name = document.getElementById("full-name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();
    const state = document.getElementById("state").value;
    const notes = document.getElementById("notes").value.trim();
    const receipt = document.getElementById("receipt").files[0];

    error.textContent = "";

    if (!name || !phone || !address || !state) {
      error.textContent = "Please fill in your name, phone, address and state.";
      return;
    }

    const hasInstallment = data.cart.some(function (item) {
      return item.mode === "installment";
    });
    if (hasInstallment && !email) {
      error.textContent = "Please enter your email address. We send installment payment reminders by email.";
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

    const reference = "JL" + Date.now() + Math.floor(1000 + Math.random() * 9000);
    const type = receipt.type || "image/jpeg";
    const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = reference + "." + ext;

    const items = data.cart.map(function (item) {
      const p = findProduct(item.id);
      return {
        id: item.id,
        name: p ? p.name : "Unknown item",
        price: p ? p.price : 0,
        qty: item.qty,
        mode: item.mode,
        frequency: item.frequency || null,
        count: item.count || null,
        size: item.size || null,
        color: item.color || null
      };
    });

    const userToken = (typeof Auth !== "undefined") ? await Auth.token() : null;

    function headers(extra) {
      const h = { apikey: SUPABASE_KEY };
      if (userToken) {
        h.Authorization = "Bearer " + userToken;
      } else if (SUPABASE_KEY.indexOf("eyJ") === 0) {
        h.Authorization = "Bearer " + SUPABASE_KEY;
      }
      for (const key in extra) {
        h[key] = extra[key];
      }
      return h;
    }

    placeButton.disabled = true;
    placeButton.textContent = "Placing order...";

    try {
      const up = await fetch(SUPABASE_URL + "/storage/v1/object/receipts/" + path, {
        method: "POST",
        headers: headers({ "Content-Type": type }),
        body: receipt
      });
      if (!up.ok) {
        throw new Error("Receipt upload failed (" + up.status + ")");
      }

      const res = await fetch(SUPABASE_URL + "/rest/v1/orders", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({
          reference: reference,
          customer_name: name,
          phone: phone,
          email: email || null,
          state: state,
          address: address,
          notes: notes || null,
          items: items,
          items_total: data.itemsTotal,
          delivery_fee: window.deliveryFeeNow || 0,
          pay_now: data.dueNow + (window.deliveryFeeNow || 0) - (window.referralDiscount || 0),
          discount: window.referralDiscount || 0,
          receipt_path: path
        })
      });
      if (!res.ok) {
        let reason = "";
        try {
          reason = (await res.json()).message || "";
        } catch (e) {}
        throw new Error(reason || ("Could not save the order (" + res.status + ")"));
      }

      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem("jaolabOrders")) || [];
      } catch (e) {
        saved = [];
      }
      saved.push({
        ref: reference,
        date: new Date().toLocaleString(),
        items: data.cart,
        payNow: data.dueNow + (window.deliveryFeeNow || 0) - (window.referralDiscount || 0),
        status: "Awaiting payment verification"
      });
      localStorage.setItem("jaolabOrders", JSON.stringify(saved));
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
}
// ================= INFO PAGES =================
const ICONS = {
  whatsapp: "<svg viewBox='0 0 24 24'><path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'/></svg>",
  phone: "<svg viewBox='0 0 24 24'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/></svg>",
  mail: "<svg viewBox='0 0 24 24'><path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'/><polyline points='22,6 12,13 2,6'/></svg>",
  tiktok: "<svg viewBox='0 0 24 24'><path d='M9 18V5l12-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='18' cy='16' r='3'/></svg>",
  pin: "<svg viewBox='0 0 24 24'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>"
};

function contactRow(icon, label, text, link) {
  const tag = link ? "a href='" + link + "'" : "div";
  const end = link ? "a" : "div";
  return "<" + tag + " class='contact-row'>" +
    "<span class='ico'>" + icon + "</span>" +
    "<span class='contact-text'><small>" + label + "</small>" + text + "</span>" +
    "</" + end + ">";
}

function emailButton(text, subject) {
  return "<a class='btn-link' href='mailto:" + STORE_EMAIL + "?subject=" + encodeURIComponent(subject) + "'>" +
    "<span class='ico'>" + ICONS.mail + "</span>" + text + "</a>";
}

const infoPages = {

  about: {
    title: "About us",
    body:
      "<h3>Welcome to Jao Lab Fashion &amp; Styles</h3>" +
      "<p>Jao Lab Fashion &amp; Styles is a Lagos-based online fashion store built for Nigerians who want good style at fair prices. We bring clothing, footwear, bags and accessories for men, women and children together in one easy place to shop.</p>" +
      "<h3>Our story</h3>" +
      "<p>We started with a simple idea: looking good should not mean paying everything at once. Many shoppers see something they love but cannot always pay the full amount on the day. So we built a store that works around real life.</p>" +
      "<h3>Pay your way</h3>" +
      "<p>You can pay in full, or spread the cost of your order into weekly or monthly installments. Choose the plan that suits your income, see exactly what you will pay before you commit, and complete your payments at your own pace.</p>" +
      "<h3>What we stand for</h3>" +
      "<p><strong>Style for everyone.</strong> Fashion for men, women and kids, from everyday wear to special occasions.</p>" +
      "<p><strong>Clear pricing.</strong> Every price is in naira, and your total and payment plan are shown before you order.</p>" +
      "<p><strong>Honest service.</strong> We verify every payment, keep you updated on your order, and answer your questions.</p>" +
      "<h3>Get in touch</h3>" +
      "<p>Questions about an item, a payment or a delivery? Email us at <a href='mailto:" + STORE_EMAIL + "'>" + STORE_EMAIL + "</a> or visit our Contact page.</p>"
  },

  installments: {
    title: "How installments work",
    body:
      "<p>Our installment plan lets you pay for an item in parts instead of all at once.</p>" +
      "<h3>Step by step</h3>" +
      "<p><strong>1. Choose your item.</strong> Open any product and find the Plan setup section.</p>" +
      "<p><strong>2. Pick Weekly or Monthly.</strong> Then choose how many installments you want.</p>" +
      "<p><strong>3. See your amount.</strong> The amount you pay each week or month, and the total, are shown before you commit.</p>" +
      "<p><strong>4. Start your plan.</strong> Tap Start Installment Plan, add your delivery details at checkout and pay your first installment by bank transfer.</p>" +
      "<p><strong>5. Complete your payments.</strong> Keep paying on schedule and upload each receipt. We verify every payment.</p>" +
      "<p><strong>6. Receive your order.</strong> Your item is dispatched after the final payment has been completed and verified.</p>" +
      "<h3>Good to know</h3>" +
      "<p>Your order is not dispatched until it is fully paid. If you are going to miss a payment, email us before the due date at <a href='mailto:" + STORE_EMAIL + "'>" + STORE_EMAIL + "</a> so we can help.</p>"
  },

  delivery: {
    title: "Delivery",
    body:
      "<h3>Where we deliver</h3>" +
      "<p>We deliver to customers across Nigeria. Enter your full address and state at checkout so your order reaches you without delay.</p>" +
      "<h3>Delivery fees</h3>" +
      "<p>Any delivery fee that applies to your order is shown at checkout before you place it.</p>" +
      "<h3>Order processing</h3>" +
      "<p>We begin processing your order after your payment has been verified. Uploading a receipt does not confirm payment until we have checked it.</p>" +
      "<h3>Installment orders</h3>" +
      "<p>Items bought on an installment plan are dispatched after the final payment has been completed and verified.</p>" +
      "<h3>Need help with a delivery?</h3>" +
      "<p>Email us with your order reference and we will update you.</p>" +
      emailButton("Email us about a delivery", "Delivery enquiry")
  },

  returns: {
    title: "Returns &amp; Refunds",
    body:
      "<p>We want you to be happy with your purchase. Please read this policy so you know what to expect.</p>" +
      "<h3>Return window</h3>" +
      "<p>You may request a return within 7 days of receiving your order.</p>" +
      "<h3>What can be returned</h3>" +
      "<p>Items must be unworn, unwashed and unaltered, in their original condition, with all tags and packaging attached.</p>" +
      "<h3>What cannot be returned</h3>" +
      "<p>Underwear and swimwear, items that have been worn, washed, altered or damaged after delivery, and items without their original tags.</p>" +
      "<h3>Wrong, faulty or damaged items</h3>" +
      "<p>If you receive the wrong item, or one that is faulty or damaged, email us within 48 hours of delivery with clear photos. We will arrange a replacement or a refund.</p>" +
      "<h3>How to start a return</h3>" +
      "<p>1. Email us with your order reference, the item and the reason for the return.</p>" +
      "<p>2. Attach clear photos of the item, and of any fault or damage.</p>" +
      "<p>3. Wait for our approval and return instructions before sending anything back.</p>" +
      emailButton("Email us to start a return", "Return request - Order reference") +
      "<h3>Refunds</h3>" +
      "<p>When your return reaches us we inspect it. If it is approved, your refund is sent to the bank account you give us within 7 working days. Delivery fees are not refunded unless the return is due to our error.</p>" +
      "<h3>Installment orders</h3>" +
      "<p>An installment order is not dispatched until it is fully paid. If you cancel before dispatch, email us and we will review the amount you have paid. Approved refunds follow the process above.</p>"
  },
  privacy: {
    title: "Privacy Policy",
    body:
      "<p>Last updated: October 2026</p>" +
      "<p>Jao Lab Fashion &amp; Styles respects your privacy. This policy explains what personal information we collect, why we collect it and how we protect it. We handle personal data in line with applicable Nigerian data protection law.</p>" +
      "<h3>Information we collect</h3>" +
      "<p>When you order, we collect your name, phone number, email address (if you give one), delivery address and state, your order details, and the payment receipt you upload.</p>" +
      "<h3>How we use it</h3>" +
      "<p>We use your information to process and deliver your orders, verify your payments, manage your installment plan, answer your questions and keep our records accurate.</p>" +
      "<h3>Who we share it with</h3>" +
      "<p>We do not sell your personal information. We share it only where needed to complete your order, for example with a delivery partner, or where the law requires it.</p>" +
      "<h3>Payment information</h3>" +
      "<p>You pay by bank transfer. We never ask for your card number, PIN or banking password. Never share these with anyone claiming to represent us.</p>" +
      "<h3>Cookies and browser storage</h3>" +
      "<p>Our website stores your cart and order details in your own browser so the shop works properly. You can clear this at any time from your browser settings.</p>" +
      "<h3>How long we keep it</h3>" +
      "<p>We keep your information only as long as needed for your order, our records and legal obligations.</p>" +
      "<h3>Security</h3>" +
      "<p>We take reasonable steps to protect your information from loss, misuse and unauthorized access. No online system is completely secure, so please keep your own details safe.</p>" +
      "<h3>Your rights</h3>" +
      "<p>You may ask to see, correct or delete the personal information we hold about you, subject to legal requirements.</p>" +
      "<h3>Children</h3>" +
      "<p>Our store is intended for adults. Children should shop only with a parent or guardian.</p>" +
      "<h3>Changes to this policy</h3>" +
      "<p>We may update this policy from time to time. The latest version is always on this page.</p>" +
      "<h3>Contact us about your privacy</h3>" +
      emailButton("Email us about privacy", "Privacy request")
  },

  terms: {
    title: "Terms &amp; Conditions",
    body:
      "<p>Last updated: October 2026</p>" +
      "<p>By using Jao Lab Fashion &amp; Styles and placing an order, you agree to these terms.</p>" +
      "<h3>Prices and products</h3>" +
      "<p>All prices are in Nigerian naira (₦). We try to describe and show our products accurately, but colors may look slightly different on different screens. We may correct pricing errors and cancel an affected order, with a full refund of any amount paid.</p>" +
      "<h3>Orders</h3>" +
      "<p>Placing an order is an offer to buy. We accept it once we have verified your payment. We may decline or cancel an order if an item is unavailable or we cannot verify your payment or details.</p>" +
      "<h3>Payment</h3>" +
      "<p>You pay by bank transfer to the account shown at checkout and upload your receipt. An uploaded receipt is not confirmation of payment until we have verified it.</p>" +
      "<h3>Installment plans</h3>" +
      "<p>When you choose an installment plan, you agree to pay the stated amount on each due date for the chosen number of installments. The item is dispatched only after the final payment has been completed and verified. Late or missed payments may delay your order, so please email us before a due date if you need help.</p>" +
      "<h3>Delivery</h3>" +
      "<p>You must give a complete and correct delivery address. Delivery times are estimates and may vary. See our Delivery page for details.</p>" +
      "<h3>Returns and refunds</h3>" +
      "<p>Returns and refunds are handled under our Returns &amp; Refunds policy.</p>" +
      "<h3>Your responsibilities</h3>" +
      "<p>You agree to give accurate information and not to misuse the website, including by submitting fake payment receipts. We may refuse service where we suspect fraud.</p>" +
      "<h3>Limitation of liability</h3>" +
      "<p>To the extent allowed by law, we are not liable for losses caused by events outside our control, such as network or courier delays.</p>" +
      "<h3>Changes and governing law</h3>" +
      "<p>We may update these terms from time to time. They are governed by the laws of the Federal Republic of Nigeria.</p>" +
      "<h3>Questions</h3>" +
      emailButton("Email us about these terms", "Terms enquiry")
  },

  faq: {
    title: "FAQ",
    body:
      "<h3>How do I place an order?</h3>" +
      "<p>Open a product, tap Add to cart or Buy Now, go to your cart, tap Checkout, enter your delivery details, pay by bank transfer and upload your receipt.</p>" +
      "<h3>How do I pay?</h3>" +
      "<p>By bank transfer to the account shown at checkout. Upload your receipt so we can verify it.</p>" +
      "<h3>How do installments work?</h3>" +
      "<p>Pick Weekly or Monthly on the product page, choose the number of installments and start your plan. See our How installments work page for the full steps.</p>" +
      "<h3>When is an installment item delivered?</h3>" +
      "<p>After your final payment has been completed and verified.</p>" +
      "<h3>Can I return an item?</h3>" +
      "<p>Yes, within 7 days if it is unworn and in its original condition. See our Returns &amp; Refunds page.</p>" +
      "<h3>Do you deliver outside Lagos?</h3>" +
      "<p>Yes, we deliver across Nigeria. Delivery fees are shown at checkout.</p>" +
      "<h3>How do I contact you?</h3>" +
      "<p>Email us at <a href='mailto:" + STORE_EMAIL + "'>" + STORE_EMAIL + "</a>, or see our Contact page.</p>"
  },

  contact: {
    title: "Contact us",
    body:
      "<p>We are based in Lagos, Nigeria. For orders, payments, returns and any other question, email is the best way to reach us.</p>" +
      emailButton("Email us", "Enquiry") +
      "<h3>Email</h3>" +
      contactRow(ICONS.mail, "Email", STORE_EMAIL, "mailto:" + STORE_EMAIL) +
      "<h3>WhatsApp</h3>" +
      contactRow(ICONS.whatsapp, "WhatsApp", "0805 581 4073", "https://wa.me/2348055814073") +
      contactRow(ICONS.whatsapp, "WhatsApp", "0805 268 9472", "https://wa.me/2348052689472") +
      "<h3>Phone</h3>" +
      contactRow(ICONS.phone, "Call", "0805 581 4073", "tel:08055814073") +
      contactRow(ICONS.phone, "Call", "0805 268 9472", "tel:08052689472") +
      "<h3>Social media</h3>" +
      contactRow(ICONS.tiktok, "TikTok", "@raymonjao0", "") +
      "<h3>Location</h3>" +
      contactRow(ICONS.pin, "Based in", "Lagos, Nigeria", "")
  }
};

const infoContent = document.getElementById("info-content");

if (infoContent) {
  const key = new URLSearchParams(window.location.search).get("page");
  const page = infoPages[key];
  const titleBox = document.getElementById("info-title");

  if (page) {
    if (titleBox) {
      titleBox.innerHTML = page.title;
    }
    infoContent.innerHTML = page.body;
  } else {
    infoContent.innerHTML = "<p>Page not found.</p>";
  }
}

// ================= ORDERS PAGE =================
const ordersBox = document.getElementById("orders-list");

if (ordersBox) {
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem("jaolabOrders")) || [];
  } catch (e) {
    orders = [];
  }

  if (orders.length === 0) {
    ordersBox.innerHTML =
      "<div class='empty'>" +
      "<p>You have no orders yet</p>" +
      "<a href='index.html' class='btn-orange'>Start shopping</a>" +
      "</div>";
  } else {
    let html = "";

    orders.slice().reverse().forEach(function (order) {
      let itemsHtml = "";

      order.items.forEach(function (item) {
        const p = findProduct(item.id);
        if (!p) return;

        let how = "";
        if (item.mode === "installment") {
          const unit = planOptions[item.frequency].unit;
          how = "Installment plan: " + item.count + " " + unit + "s";
        } else {
          how = "Pay once · Quantity " + item.qty;
        }

        itemsHtml += "<p class='order-line'>" + p.name + "<small>" + how + "</small></p>";
      });

      html +=
        "<div class='order-card'>" +
        "<div class='order-top'><strong>" + order.ref + "</strong>" +
        "<span class='status' data-ref='" + order.ref + "'>" + order.status + "</span></div>" +
        "<small class='order-date'>" + order.date + "</small>" +
        itemsHtml +
        "<div class='total-row'><span>Paid now</span><strong>" + formatPrice(order.payNow) + "</strong></div>" +
        "</div>";
    });

    ordersBox.innerHTML = html;
    // Ask the database for the real status of each order
    const statusLabels = {
      awaiting_verification: "Awaiting payment verification",
      payment_verified: "Payment verified",
      payment_rejected: "Payment rejected",
      processing: "Processing",
      dispatched: "Dispatched",
      delivered: "Delivered",
      cancelled: "Cancelled"
    };

    const statusHeaders = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
    if (SUPABASE_KEY.indexOf("eyJ") === 0) {
      statusHeaders.Authorization = "Bearer " + SUPABASE_KEY;
    }

    fetch(SUPABASE_URL + "/rest/v1/rpc/order_statuses", {
      method: "POST",
      headers: statusHeaders,
      body: JSON.stringify({
        refs: orders.map(function (o) {
          return o.ref;
        })
      })
    })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (rows) {
        rows.forEach(function (row) {
          const tag = document.querySelector(".status[data-ref='" + row.reference + "']");
          if (tag) {
            tag.textContent = statusLabels[row.status] || row.status;
          }
        });
      })
      .catch(function () {});
  }
}

// ================= RUN ON EVERY PAGE =================
updateCartCount();