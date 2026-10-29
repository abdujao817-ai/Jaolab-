// ================= CUSTOMER LOGIN =================
const Auth = (function () {
  const KEY = "jaolabSession";

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  }

  function write(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function plainHeaders() {
    return { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  }

  function toSession(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
      user: data.user
    };
  }

  function errorText(data, fallback) {
    return (data && (data.msg || data.error_description || data.message)) || fallback;
  }

  async function signUp(email, password, meta) {
    const res = await fetch(SUPABASE_URL + "/auth/v1/signup", {
      method: "POST",
      headers: plainHeaders(),
      body: JSON.stringify({ email: email, password: password, data: meta || {} })
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(errorText(data, "Could not create the account."));
    }
    if (data.access_token) {
      write(toSession(data));
      return { signedIn: true };
    }
    return { signedIn: false };
  }

  async function signIn(email, password) {
    const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: plainHeaders(),
      body: JSON.stringify({ email: email, password: password })
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(errorText(data, "Wrong email or password."));
    }
    write(toSession(data));
  }
  // Returns a valid access token, refreshing it if needed, or null
  async function token() {
    const s = read();
    if (!s) return null;
    if (Date.now() < s.expires_at) return s.access_token;

    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: plainHeaders(),
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) {
        clear();
        return null;
      }
      const data = await res.json();
      write(toSession(data));
      return data.access_token;
    } catch (e) {
      return null;
    }
  }

  async function headers(extra) {
    const t = await token();
    const h = { apikey: SUPABASE_KEY };
    if (t) {
      h.Authorization = "Bearer " + t;
    } else if (SUPABASE_KEY.indexOf("eyJ") === 0) {
      h.Authorization = "Bearer " + SUPABASE_KEY;
    }
    for (const key in extra) {
      h[key] = extra[key];
    }
    return h;
  }

  async function signOut() {
    const t = await token();
    if (t) {
      try {
        await fetch(SUPABASE_URL + "/auth/v1/logout", {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + t }
        });
      } catch (e) {}
    }
    clear();
  }

  function user() {
    const s = read();
    return s ? s.user : null;
  }

  return { signUp: signUp, signIn: signIn, signOut: signOut, token: token, headers: headers, user: user };
})();