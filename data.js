// ================= SUPABASE CONNECTION =================
const SUPABASE_URL = "https://bwjavogmeexmxrljashb.supabase.co";
const SUPABASE_KEY = "sb_publishable_2pZnBxaMofeNC3RcJCuQtw_XbHiZL3e";

// Photos in the images folder, matched by product name
const localImages = {
  "Men's Casual Shirt": "images/shirt.jpg",
  "Women's Summer Dress": "images/dress.jpg",
  "Kids Sneakers": "images/sneakers.jpg",
  "Leather Handbag": "images/handbag.jpg",
  "Men's Slides": "images/slides.jpg",
  "Women's Ankara Top": "images/ankara.jpg"
};

// Built-in products: used if the database cannot be reached
let products = [
  { id: 1, name: "Men's Casual Shirt", price: 8500, category: "Men", image_url: null },
  { id: 2, name: "Women's Summer Dress", price: 12000, category: "Women", image_url: null },
  { id: 3, name: "Kids Sneakers", price: 9000, category: "Kids", image_url: null },
  { id: 4, name: "Leather Handbag", price: 15500, category: "Bags", image_url: null },
  { id: 5, name: "Men's Slides", price: 4500, category: "Shoes", image_url: null },
  { id: 6, name: "Women's Ankara Top", price: 7000, category: "Women", image_url: null }
];

async function loadProducts() {
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/products?select=*&order=id.asc",
    { headers: { apikey: SUPABASE_KEY } }
  );

  if (!response.ok) {
    throw new Error("Products request failed: " + response.status);
  }

  const data = await response.json();
  if (data.length > 0) {
    products = data;
  }
}

// Fill in a local photo for any product that has no image yet
function addLocalImages() {
  products.forEach(function (product) {
    if (!product.image_url && localImages[product.name]) {
      product.image_url = localImages[product.name];
    }
  });
}

function startApp() {
  const script = document.createElement("script");
  script.src = "js/app.js";
  script.onload = function () {
    [].concat(window.afterApp || []).forEach(function (src) {
      const extra = document.createElement("script");
      extra.src = src;
      document.body.appendChild(extra);
    });
  };
  document.body.appendChild(script);
}

loadProducts()
  .catch(function (error) {
    console.warn("Using built-in products. Reason:", error);
  })
  .then(addLocalImages)
  .then(startApp);
// Installable app support
(function () {
  const s = document.createElement("script");
  s.src = "js/pwa.js";
  document.head.appendChild(s);
})();