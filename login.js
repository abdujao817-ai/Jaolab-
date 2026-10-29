// ================= LOG IN AND SIGN UP =================
(function () {
  window.loginReady = true;

  const STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
    "Taraba", "Yobe", "Zamfara"
  ];

  const EYE = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>';
  const EYE_OFF = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';

  let appliedReferral = "";

  function $(id) {
    return document.getElementById(id);
  }

  function msg(el, text, good) {
    el.textContent = text;
    el.style.color = good ? "#4cd964" : "#ff5a5a";
  }

  function nextPage() {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && /^[a-z0-9-]+\.html(\?[a-z0-9=&_.-]*)?$/i.test(n) ? n : "account.html";
  }

  // Already logged in? Go straight on.
  if (Auth.user()) {
    window.location.replace(nextPage());
    return;
  }

  STATES.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    $("su-state").appendChild(option);
  });

  // ---------- Tabs ----------
  function showTab(name) {
    const login = name === "login";
    $("login-pane").style.display = login ? "block" : "none";
    $("signup-pane").style.display = login ? "none" : "block";
    $("tab-login").className = login ? "on" : "";
    $("tab-signup").className = login ? "" : "on";
  }

  $("tab-login").onclick = function () { showTab("login"); };
  $("tab-signup").onclick = function () { showTab("signup"); };

  // ---------- Password eye ----------
  document.querySelectorAll(".lg-eye").forEach(function (btn) {
    const svg = btn.firstElementChild;
    svg.innerHTML = EYE_OFF;

    btn.onclick = function () {
      const input = $(btn.getAttribute("data-target"));
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      svg.innerHTML = hidden ? EYE : EYE_OFF;
    };
  });

  // ---------- Password strength ----------
  $("su-pass").oninput = function () {
    const p = $("su-pass").value;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    const bar = $("su-strength");
    bar.style.width = (p ? Math.max(score, 1) * 20 : 0) + "%";
    bar.style.background = score <= 2 ? "#ff5a5a" : score <= 3 ? "#ffb066" : "#4cd964";
    $("su-strength-text").textContent = !p
      ? "Use 8 or more characters. Mix letters, numbers and symbols."
      : score <= 2 ? "Weak password" : score <= 3 ? "Okay password" : "Strong password";
  };

  // ---------- Phone ----------
  function cleanPhone(text) {
    let p = text.replace(/[\s\-()]/g, "");
    p = p.replace(/^\+?234/, "0");
    return /^0[789][01]\d{8}$/.test(p) ? p : null;
  }

  // ---------- Referral code ----------
  $("ref-toggle").onclick = function () {
    const box = $("ref-box");
    box.classList.toggle("open");
    $("ref-arrow").textContent = box.classList.contains("open") ? "▴" : "▾";
  };

  async function codeIsValid(code) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/check_referral", {
      method: "POST",
      headers: await Auth.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ p_code: code })
    });
    if (!res.ok) {
      throw new Error("Could not check the code (" + res.status + ").");
    }
    return res.json();
  }

  $("ref-apply").onclick = async function () {
    const code = $("su-ref").value.trim().toUpperCase();
    const out = $("ref-msg");

    if (!code) {
      appliedReferral = "";
      msg(out, "", true);
      return;
    }

    msg(out, "Checking...", true);
    try {
      if (await codeIsValid(code)) {
        appliedReferral = code;
        msg(out, "Code applied ✓", true);
      } else {
        appliedReferral = "";
        msg(out, "That code is not valid.", false);
      }
    } catch (e) {
      msg(out, e.message, false);
    }
  };

  // ---------- Profile set-up after the account exists ----------
  async function ensureProfile() {
    const user = Auth.user();
    if (!user) return;

    const meta = user.user_metadata || {};
    let row = null;

    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/profiles?select=id,referred_by&id=eq." + user.id, {
        headers: await Auth.headers()
      });
      if (res.ok) {
        const rows = await res.json();
        row = rows[0] || null;
      }

      if (!row) {
        await fetch(SUPABASE_URL + "/rest/v1/profiles", {
          method: "POST",
          headers: await Auth.headers({
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
          }),
          body: JSON.stringify({
            id: user.id,
            full_name: meta.full_name || null,
            phone: meta.phone || null,
            state: meta.state || null,
            terms_accepted_at: meta.terms_accepted_at || null,
            updated_at: new Date().toISOString()
          })
        });
      }

      if (meta.referral && (!row || !row.referred_by)) {
        await fetch(SUPABASE_URL + "/rest/v1/rpc/apply_referral", {
          method: "POST",
          headers: await Auth.headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ p_code: meta.referral })
        });
      }
    } catch (e) {}
  }

  // ---------- Log in ----------
  $("li-btn").onclick = async function () {
    const email = $("li-email").value.trim();
    const password = $("li-pass").value;
    const out = $("li-msg");

    if (!email || !password) {
      msg(out, "Enter your email and password.", false);
      return;
    }

    $("li-btn").disabled = true;
    msg(out, "Logging in...", true);

    try {
      await Auth.signIn(email, password);
      await ensureProfile();
      window.location.href = nextPage();
    } catch (e) {
      msg(out, e.message, false);
      $("li-btn").disabled = false;
    }
  };

  // ---------- Sign up ----------
  let pending = null;

  $("su-btn").onclick = async function () {
    const out = $("su-msg");
    const name = $("su-name").value.trim();
    const email = $("su-email").value.trim();
    const phone = cleanPhone($("su-phone").value);
    const state = $("su-state").value;
    const password = $("su-pass").value;
    const typedCode = $("su-ref").value.trim().toUpperCase();

    if (name.length < 2) return msg(out, "Please enter your full name.", false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg(out, "Please enter a valid email address.", false);
    if (!phone) return msg(out, "Please enter one valid Nigerian phone number.", false);
    if (!state) return msg(out, "Please select your state.", false);
    if (password.length < 8) return msg(out, "Your password must be at least 8 characters.", false);

    if (typedCode && typedCode !== appliedReferral) {
      msg(out, "Checking your referral code...", true);
      try {
        if (await codeIsValid(typedCode)) {
          appliedReferral = typedCode;
          msg($("ref-msg"), "Code applied ✓", true);
        } else {
          return msg(out, "That referral code is not valid. Fix it or clear the box.", false);
        }
      } catch (e) {
        return msg(out, e.message, false);
      }
    }

    pending = { name: name, email: email, phone: phone, state: state, password: password, referral: typedCode || "" };
    out.textContent = "";
    $("c-age").checked = false;
    $("c-agree").disabled = true;
    $("consent").classList.add("show");
  };

  $("c-age").onchange = function () {
    $("c-agree").disabled = !$("c-age").checked;
  };

  $("c-cancel").onclick = function () {
    $("consent").classList.remove("show");
  };

  $("c-agree").onclick = async function () {
    if (!pending) return;
    const out = $("su-msg");

    $("c-agree").disabled = true;
    $("c-agree").textContent = "Creating your account...";

    try {
      const result = await Auth.signUp(pending.email, pending.password, {
        full_name: pending.name,
        phone: pending.phone,
        state: pending.state,
        referral: pending.referral || null,
        terms_accepted_at: new Date().toISOString()
      });

      $("consent").classList.remove("show");

      if (result.signedIn) {
        await ensureProfile();
        window.location.href = nextPage();
      } else {
        showTab("login");
        msg($("li-msg"), "Account created. Check your email to confirm it, then log in.", true);
      }
    } catch (e) {
      $("consent").classList.remove("show");
      msg(out, e.message, false);
    }

    $("c-agree").textContent = "Agree and continue";
    pending = null;
  };

  // ---------- Start ----------
  if (new URLSearchParams(window.location.search).get("mode") === "signup") {
    showTab("signup");
  }
  (async function () {
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/referral_settings?select=*&id=eq.1", {
        headers: await Auth.headers()
      });
      if (!res.ok) return;
      const s = (await res.json())[0];
      if (s && s.enabled && s.friend_discount > 0) {
        $("ref-msg").textContent =
          "Get ₦" + Number(s.friend_discount).toLocaleString() + " off your first order of ₦" +
          Number(s.min_order).toLocaleString() + " or more.";
      }
    } catch (e) {}
  })();
})();