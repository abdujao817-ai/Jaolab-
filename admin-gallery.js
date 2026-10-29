// ================= ADMIN: extra photos, sizes and colors helpers =================
let editingExtra = [];

function splitList(text) {
  const seen = {};
  return String(text || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      if (!s || seen[s.toLowerCase()]) return false;
      seen[s.toLowerCase()] = true;
      return true;
    })
    .slice(0, 30);
}

function drawExtra() {
  const box = document.getElementById("extra-list");
  if (!box) return;

  box.innerHTML = editingExtra.map(function (url, i) {
    const safe = String(url).replace(/'/g, "%27");
    return (
      "<span style='position:relative;display:inline-block;margin:0 10px 10px 0'>" +
      "<span class='a-thumb' style=\"display:inline-block;background-image:url('" + safe + "')\"></span>" +
      "<button type='button' data-xrm='" + i + "' style='position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:12px;border:none;background:#c0392b;color:#fff;font-size:13px'>✕</button>" +
      "</span>"
    );
  }).join("");
}

document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-xrm]");
  if (!button) return;
  editingExtra.splice(Number(button.getAttribute("data-xrm")), 1);
  drawExtra();
});