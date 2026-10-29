// ================= PROFILE PAGE =================
(function () {
  window.accountReady = true;

  if (!Auth.user()) {
    window.location.replace("login.html?next=account.html");
    return;
  }

  const STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
    "Taraba", "Yobe", "Zamfara"
  ];

  let current = { avatar_url: null, full_name: "", referral_code: "" };

  function $(id) {
    return document.getElementById(id);
  }

  function msg(el, text, good) {
    el.textContent = text;
    el.style.color = good ? "#4cd964" : "#ff5a5a";
  }

  STATES.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    $("pf-state").appendChild(option);
  });

  // ---------- Draw the profile card ----------
  function draw() {
    const user = Auth.user();
    $("pf-title").textContent = current.full_name || "Your name";
    $("pf-email").textContent = user.email || "";

    if (user.created_at) {
      const d = new Date(user.created_at);
      $("pf-since").textContent = isNaN(d) ? "" : "Member since " + d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    const photo = $("pf-photo");
    if (current.avatar_url) {
      photo.textContent = "";
      photo.style.backgroundImage = "url('" + current.avatar_url + "')";
    } else {
      photo.style.backgroundImage = "none";
      photo.textContent = (current.full_name || user.email || "?").trim().charAt(0).toUpperCase();
    }
    $("av-remove").style.display = current.avatar_url ? "block" : "none";
    $("rf-code").textContent = current.referral_code || "------";
  }

  // ---------- Profile data ----------
  async function upsertProfile(fields) {
    const user = Auth.user();
    const body = Object.assign({ id: user.id, updated_at: new Date().toISOString() }, fields);

    return fetch(SUPABASE_URL + "/rest/v1/profiles", {
      method: "POST",
      headers: await Auth.headers({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      }),
      body: JSON.stringify(body)
    });
  }

  async function loadProfile() {
    const user = Auth.user();
    let row = null;

    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=*&id=eq." + user.id, {
        headers: await Auth.headers()
      });
      if (res.status === 401) {
        await Auth.signOut();
        window.location.replace("login.html?next=account.html");
        return;
      }
      if (res.ok) {
        const rows = await res.json();
        row = rows[0] || null;
      }

      if (!row) {
        const created = await upsertProfile({});
        if (created.ok) {
          const rows = await created.json();
          row = rows[0] || null;
        }
      }
    } catch (e) {}

    const p = row || {};
    $("pf-name-in").value = p.full_name || "";
    $("pf-phone").value = p.phone || "";
    $("pf-state").value = p.state || "";
    $("pf-address").value = p.address || "";
    current.avatar_url = p.avatar_url || null;
    current.full_name = p.full_name || "";
    current.referral_code = p.referral_code || "";
    draw();

    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_referral_count", {
        method: "POST",
        headers: await Auth.headers({ "Content-Type": "application/json" }),
        body: "{}"
      });
      if (res.ok) {
        const n = await res.json();
        $("rf-count").textContent = n === 1 ? "1 friend has joined with your code." : n + " friends have joined with your code.";
      }
    } catch (e) {}
  }

  // ---------- Referral credit and rules ----------
  async function loadCredit() {
    try {
      const headers = await Auth.headers();
      const results = await Promise.all([
        fetch(SUPABASE_URL + "/rest/v1/referral_settings?select=*&id=eq.1", { headers: headers }),
        fetch(SUPABASE_URL + "/rest/v1/referral_credits?select=amount&status=eq.available", { headers: headers })
      ]);

      if (results[0].ok) {
        const s = (await results[0].json())[0];
        if (s && s.enabled) {
          $("rf-terms").textContent =
            "Friends get ₦" + Number(s.friend_discount).toLocaleString() + " off their first order of ₦" +
            Number(s.min_order).toLocaleString() + " or more. You earn ₦" +
            Number(s.referrer_reward).toLocaleString() + " credit when that order's payment is verified.";
        }
      }

      if (results[1].ok) {
        const credits = await results[1].json();
        const total = credits.reduce(function (sum, c) {
          return sum + c.amount;
        }, 0);
        if (total > 0) {
          $("rf-credit").textContent = "Your referral credit: ₦" + total.toLocaleString() + " (used automatically at checkout)";
        }
      }
    } catch (e) {}
  }

  function shareText() {
    return "Join me on Jao Lab Fashion & Styles. Use my referral code " + current.referral_code + " when you sign up.";
  }

  $("rf-copy").onclick = async function () {
    if (!current.referral_code) return;
    try {
      await navigator.clipboard.writeText(current.referral_code);
      $("rf-copy").textContent = "Copied ✓";
    } catch (e) {
      window.prompt("Copy your referral code:", current.referral_code);
    }
    setTimeout(function () {
      $("rf-copy").textContent = "Copy";
    }, 1500);
  };

  if (navigator.share) {
    $("rf-share").style.display = "block";
    $("rf-share").onclick = function () {
      if (!current.referral_code) return;
      navigator.share({ title: "Jao Lab Fashion & Styles", text: shareText() }).catch(function () {});
    };
  }

  // ---------- Profile photo ----------
  function squareJpeg(file, size) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = function () {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);

        canvas.toBlob(function (blob) {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not process the photo."));
          }
        }, "image/jpeg", 0.85);
      };

      img.onerror = function () {
        reject(new Error("Could not read that photo. Try a JPG or PNG."));
      };

      img.src = url;
    });
  }

  function pathFromUrl(url) {
    const marker = "/object/public/avatars/";
    const i = url ? url.indexOf(marker) : -1;
    return i === -1 ? null : url.slice(i + marker.length).split("?")[0];
  }

  async function deleteFile(url) {
    const path = pathFromUrl(url);
    if (!path) return;
    try {
      await fetch(SUPABASE_URL + "/storage/v1/object/avatars/" + path, {
        method: "DELETE",
        headers: await Auth.headers()
      });
    } catch (e) {}
  }

  $("av-file").onchange = async function () {
    const file = $("av-file").files[0];
    const out = $("av-msg");
    if (!file) return;

    const user = Auth.user();
    msg(out, "Uploading photo...", true);

    try {
      const blob = await squareJpeg(file, 400);
      const path = user.id + "/" + Date.now() + ".jpg";

      const up = await fetch(SUPABASE_URL + "/storage/v1/object/avatars/" + path, {
        method: "POST",
        headers: await Auth.headers({ "Content-Type": "image/jpeg" }),
        body: blob
      });
      if (!up.ok) {
        throw new Error("Photo upload failed (" + up.status + ").");
      }

      const url = SUPABASE_URL + "/storage/v1/object/public/avatars/" + path;
      const res = await upsertProfile({ avatar_url: url });
      if (!res.ok) {
        throw new Error("Could not save the photo (" + res.status + ").");
      }

      const old = current.avatar_url;
      current.avatar_url = url;
      draw();
      if (old) deleteFile(old);
      msg(out, "Photo updated ✓", true);
    } catch (e) {
      msg(out, e.message, false);
    }

    $("av-file").value = "";
  };

  $("av-remove").onclick = async function () {
    const out = $("av-msg");
    if (!confirm("Remove your profile photo?")) return;

    const res = await upsertProfile({ avatar_url: null });
    if (!res.ok) {
      msg(out, "Could not remove the photo (" + res.status + ").", false);
      return;
    }

    const old = current.avatar_url;
    current.avatar_url = null;
    draw();
    if (old) deleteFile(old);
    msg(out, "Photo removed.", true);
  };

  // ---------- Personal details ----------
  $("pf-save").onclick = async function () {
    const out = $("pf-msg");
    msg(out, "Saving...", true);

    const res = await upsertProfile({
      full_name: $("pf-name-in").value.trim() || null,
      phone: $("pf-phone").value.trim() || null,
      state: $("pf-state").value || null,
      address: $("pf-address").value.trim() || null
    });

    if (res.ok) {
      current.full_name = $("pf-name-in").value.trim();
      draw();
      msg(out, "Saved ✓", true);
    } else {
      msg(out, "Could not save (" + res.status + ").", false);
    }
  };

  $("delete-link").onclick = function () {
    const user = Auth.user();
    $("delete-link").href =
      "mailto:jaolabreviews817@gmail.com?subject=" + encodeURIComponent("Account deletion request") +
      "&body=" + encodeURIComponent("Please delete my account and personal data.\n\nAccount email: " + (user ? user.email : ""));
  };

  $("logout-btn").onclick = async function (event) {
    event.preventDefault();
    await Auth.signOut();
    window.location.href = "login.html";
  };

  loadProfile();
  loadCredit();
})();