// ================= ADMIN: reviews moderation =================
(function () {
  const style = document.createElement("style");
  style.textContent =
    ".ar-item{border-top:1px solid #333;padding:12px 0;font-size:14px;line-height:1.5}" +
    ".ar-item small{color:#aaa}" +
    ".ar-stars{color:#ffb800}";
  document.head.appendChild(style);

  function panel() {
    let p = document.getElementById("reviews-admin-panel");
    if (p) return p;

    const ordersPanel = document.getElementById("orders-admin").closest("section");
    p = document.createElement("section");
    p.className = "panel";
    p.id = "reviews-admin-panel";
    p.innerHTML = "<h2>Reviews</h2><div id='reviews-admin'>Loading...</div>";
    ordersPanel.parentNode.insertBefore(p, ordersPanel);

    p.addEventListener("click", async function (event) {
      const btn = event.target.closest("button[data-rv]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-rv");

      if (act === "delete" && !confirm("Delete this review for good?")) return;

      const res = await fetch(SUPABASE_URL + "/rest/v1/reviews?id=eq." + id, {
        method: act === "delete" ? "DELETE" : "PATCH",
        headers: authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: act === "delete" ? undefined : JSON.stringify({ hidden: act === "hide" })
      });

      if (expired(res)) return;
      if (res.ok) window.loadReviewsAdmin();
      else alert("Could not update the review (" + res.status + ").");
    });

    return p;
  }

  window.loadReviewsAdmin = async function () {
    panel();
    const box = document.getElementById("reviews-admin");

    const res = await fetch(
      SUPABASE_URL + "/rest/v1/reviews?select=id,rating,body,author_name,hidden,created_at,products(name)&order=created_at.desc&limit=50",
      { headers: authHeaders() }
    );

    if (expired(res)) return;
    if (!res.ok) {
      box.textContent = "Could not load reviews (" + res.status + ").";
      return;
    }

    const rows = await res.json();
    if (rows.length === 0) {
      box.innerHTML = "<p class='hint'>No reviews yet.</p>";
      return;
    }

    box.innerHTML = rows.map(function (r) {
      return (
        "<div class='ar-item'><strong>" + escapeHtml((r.products && r.products.name) || "Product") + "</strong> " +
        "<span class='ar-stars'>" + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + "</span><br>" +
        "<small>" + escapeHtml(r.author_name) + " · " + new Date(r.created_at).toLocaleDateString() +
        (r.hidden ? " · HIDDEN" : "") + "</small>" +
        (r.body ? "<br>" + escapeHtml(r.body) : "") +
        "<div class='a-btns' style='margin-top:8px'>" +
        "<button data-rv='" + (r.hidden ? "show" : "hide") + "' data-id='" + r.id + "'>" + (r.hidden ? "Show" : "Hide") + "</button>" +
        "<button data-rv='delete' data-id='" + r.id + "'>Delete</button></div></div>"
      );
    }).join("");
  };
})();