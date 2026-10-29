// Shows the customer's photo and name on the You page
(async function () {
  if (typeof Auth === "undefined") return;

  const user = Auth.user();
  if (!user) return;

  const avatar = document.getElementById("you-avatar");
  const nameEl = document.getElementById("you-name");

  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=*&id=eq." + user.id, {
      headers: await Auth.headers()
    });
    const rows = res.ok ? await res.json() : [];
    const p = rows[0] || {};

    if (avatar) {
      if (p.avatar_url) {
        avatar.textContent = "";
        avatar.style.backgroundImage = "url('" + p.avatar_url + "')";
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
      } else {
        avatar.textContent = (p.full_name || user.email || "?").charAt(0).toUpperCase();
      }
    }

    if (nameEl) {
      nameEl.textContent = p.full_name ? "Hi, " + p.full_name : user.email;
    }
  } catch (e) {}
})();