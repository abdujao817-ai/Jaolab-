// Fills the checkout form for a logged-in customer
(async function () {
  if (typeof Auth === "undefined" || !document.getElementById("full-name")) return;

  const user = Auth.user();
  if (!user) return;

  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=*&id=eq." + user.id, {
      headers: await Auth.headers()
    });
    if (!res.ok) return;

    const rows = await res.json();
    const p = rows[0] || {};

    function fill(id, value) {
      const el = document.getElementById(id);
      if (el && !el.value && value) el.value = value;
    }

    fill("full-name", p.full_name);
    fill("phone", p.phone);
    fill("email", user.email);
    fill("address", p.address);
    fill("state", p.state);
  } catch (e) {}
})();