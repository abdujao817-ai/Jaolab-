// ================= ADMIN PAGE =================
const TOKEN_KEY = "jaolabAdminToken";
const BUCKET = "product-images";

let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
let adminProducts = [];
let editingId = null;
let editingImage = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function authHeaders(extra) {
  const headers = { apikey: SUPABASE_KEY, Authorization: "Bearer " + adminToken };
  for (const key in extra) {
    headers[key] = extra[key];
  }
  return headers;
}

function showMsg(element, text, good) {
  element.textContent = text;
  element.style.color = good ? "#4cd964" : "#ff5a5a";
}

function expired(res) {
  if (res.status === 401) {
    logout("Session expired. Please log in again.");
    return true;
  }
  return false;
}

// ---------- Login and logout ----------
async function login() {
  const email = $("admin-email").value.trim();
  const password = $("admin-password").value;
  const msg = $("login-msg");

  if (!email || !password) {
    showMsg(msg, "Enter your email and password.", false);
    return;
  }

  showMsg(msg, "Logging in...", true);

  try {
    const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });

    if (!res.ok) {
      showMsg(msg, "Login failed. Check your email and password.", false);
      return;
    }

    const data = await res.json();
    adminToken = data.access_token;
    sessionStorage.setItem(TOKEN_KEY, adminToken);
    $("admin-password").value = "";
    msg.textContent = "";
    await openDashboard();
  } catch (e) {
    showMsg(msg, "Network problem. Check your connection.", false);
  }
}

function logout(message) {
  adminToken = "";
  sessionStorage.removeItem(TOKEN_KEY);
  $("dashboard").style.display = "none";
  $("logout-btn").style.display = "none";
  $("login-box").style.display = "block";
  showMsg($("login-msg"), message || "", false);
}

async function openDashboard() {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/admins?select=user_id", {
      headers: authHeaders()
    });

    if (!res.ok) {
      logout("Session expired. Please log in again.");
      return;
    }

    const rows = await res.json();
    if (rows.length !== 1) {
      logout("This account is not an admin.");
      return;
    }
  } catch (e) {
    logout("Network problem. Check your connection.");
    return;
  }

  $("login-box").style.display = "none";
  $("dashboard").style.display = "block";
  $("logout-btn").style.display = "block";
  loadAdminProducts();
  if (window.loadOrders) { loadOrders(); }
  if (window.loadDeliveryAdmin) { loadDeliveryAdmin(); }
  if (window.loadReviewsAdmin) { loadReviewsAdmin(); }
}

// ---------- Product list ----------
async function loadAdminProducts() {
  const list = $("admin-list");

  const res = await fetch(SUPABASE_URL + "/rest/v1/products?select=*&order=id.desc", {
    headers: authHeaders()
  });

  if (expired(res)) return;
  if (!res.ok) {
    list.textContent = "Could not load products.";
    return;
  }

  adminProducts = await res.json();

  if (adminProducts.length === 0) {
    list.innerHTML = "<p class='hint'>No products yet.</p>";
    return;
  }

  list.innerHTML = adminProducts.map(function (p) {
    const thumb = p.image_url ? "background-image:url('" + p.image_url + "')" : "";
    return (
      "<div class='a-item'>" +
      "<div class='a-thumb' style=\"" + thumb + "\"></div>" +
      "<div class='a-info'>" +
      "<strong>" + escapeHtml(p.name) + "</strong>" +
      "<small>" + escapeHtml(p.category) + " · ₦" + Number(p.price).toLocaleString() +
      (p.in_stock ? "" : " · Out of stock") + (p.stock_qty == null ? "" : " · " + p.stock_qty + " in stock") + "</small>" +
      "<div class='a-btns'>" +
      "<button data-action='edit' data-id='" + p.id + "'>Edit</button>" +
      "<button data-action='stock' data-id='" + p.id + "'>" +
      (p.in_stock ? "Mark out of stock" : "Mark in stock") + "</button>" +
      "<button data-action='delete' data-id='" + p.id + "'>Delete</button>" +
      "</div></div></div>"
    );
  }).join("");
}

async function patchProduct(id, body) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/products?id=eq." + id, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (expired(res)) return false;
  return res.ok;
}

async function removeProduct(id) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/products?id=eq." + id, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (expired(res)) return false;
  return res.ok;
}

// ---------- Photo: shrink then upload ----------
function resizeImage(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function () {
      const max = 900;
      let w = img.width;
      let h = img.height;

      if (w > max || h > max) {
        if (w > h) {
          h = Math.round(h * max / w);
          w = max;
        } else {
          w = Math.round(w * max / h);
          h = max;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not process the photo"));
        }
      }, "image/jpeg", 0.8);
    };

    img.onerror = function () {
      reject(new Error("Could not read that photo"));
    };

    img.src = url;
  });
}

async function uploadPhoto(file) {
  const blob = await resizeImage(file);
  const name = "p" + Date.now() + ".jpg";

  const res = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + name, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "image/jpeg" }),
    body: blob
  });

  if (expired(res)) throw new Error("Session expired");
  if (!res.ok) throw new Error("Photo upload failed (" + res.status + ")");

  return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + name;
}

// ---------- Add / edit form ----------
function resetForm() {
  editingId = null;
  editingImage = null;
  $("form-title").textContent = "Add product";
  $("save-btn").textContent = "Add product";
  $("cancel-edit").style.display = "none";
  $("p-name").value = "";
  $("p-price").value = "";
  $("p-category").value = "";
  $("p-description").value = "";
  $("p-photo").value = "";
  $("p-stock").checked = true;
  $("p-stock-qty").value = "";
  $("preview").style.display = "none";
}

function startEdit(product) {
  editingId = product.id;
  editingImage = product.image_url || null;
  $("form-title").textContent = "Edit product";
  $("save-btn").textContent = "Save changes";
  $("cancel-edit").style.display = "block";
  $("p-name").value = product.name;
  $("p-price").value = product.price;
  $("p-category").value = product.category;
  $("p-description").value = product.description || "";
  $("p-photo").value = "";
  $("p-stock").checked = product.in_stock;
  $("p-stock-qty").value = product.stock_qty == null ? "" : product.stock_qty;

  if (product.image_url) {
    $("preview").src = product.image_url;
    $("preview").style.display = "block";
  } else {
    $("preview").style.display = "none";
  }

  $("form-msg").textContent = "";
  window.scrollTo(0, 0);
}

async function saveProduct() {
  const msg = $("form-msg");
  const saveBtn = $("save-btn");

  const name = $("p-name").value.trim();
  const priceText = $("p-price").value;
  const price = Math.round(Number(priceText));
  const category = $("p-category").value;

  if (!name || !priceText || isNaN(price) || price < 0 || !category) {
    showMsg(msg, "Enter a name, a price and a category.", false);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  msg.textContent = "";

  try {
    let imageUrl = editingImage;
    const file = $("p-photo").files[0];
    if (file) {
      imageUrl = await uploadPhoto(file);
    }

    const body = {
      name: name,
      price: price,
      category: category,
      description: $("p-description").value.trim(),
      in_stock: $("p-stock").checked,
      stock_qty: $("p-stock-qty").value === "" ? null : Math.max(0, Math.round(Number($("p-stock-qty").value))),
      image_url: imageUrl
    };

    let res;
    if (editingId) {
      res = await fetch(SUPABASE_URL + "/rest/v1/products?id=eq." + editingId, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify(body)
      });
    } else {
      res = await fetch(SUPABASE_URL + "/rest/v1/products", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify(body)
      });
    }

    if (expired(res)) return;
    if (!res.ok) throw new Error("Could not save the product (" + res.status + ")");

    resetForm();
    showMsg(msg, "Saved ✓", true);
    await loadAdminProducts();
  } catch (e) {
    showMsg(msg, e.message, false);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingId ? "Save changes" : "Add product";
  }
}

// ---------- Buttons ----------
$("login-btn").onclick = login;
$("logout-btn").onclick = function () { logout(""); };
$("save-btn").onclick = saveProduct;
$("cancel-edit").onclick = function () {
  resetForm();
  $("form-msg").textContent = "";
};

$("p-photo").onchange = function () {
  const file = $("p-photo").files[0];
  if (file) {
    $("preview").src = URL.createObjectURL(file);
    $("preview").style.display = "block";
  }
};

$("admin-list").onclick = async function (event) {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.getAttribute("data-id"));
  const action = button.getAttribute("data-action");
  const product = adminProducts.find(function (p) {
    return p.id === id;
  });
  if (!product) return;

  if (action === "edit") {
    startEdit(product);
  }

  if (action === "stock") {
    if (await patchProduct(id, { in_stock: !product.in_stock })) {
      loadAdminProducts();
    }
  }

  if (action === "delete") {
    if (confirm("Delete \"" + product.name + "\"? This cannot be undone.")) {
      if (await removeProduct(id)) {
        loadAdminProducts();
      }
    }
  }
};

// ---------- Start ----------
if (adminToken) {
  openDashboard();
}