/* ============================================================================
 * switch.js — seletor de módulos "estilo Instagram" (Gehlen's Club)
 * Toca no nome do módulo no topo → abre a lista Finanças · Retorno · Cobrança.
 * Mesmo arquivo nos três módulos, pra ficar idêntico em todos.
 * A página define window.GC_MODULE = "financas" | "retorno" | "cobranca".
 * ==========================================================================*/
(function () {
  "use strict";
  var MODULES = [
    { key: "financas", label: "Finanças",  href: "/",          ic: "₲", hint: "Caixa, contas e lucro" },
    { key: "retorno",  label: "Retorno",   href: "/retorno/",  ic: "↩", hint: "Clientes sumidos pra reagendar" },
    { key: "cobranca", label: "Cobrança",  href: "/cobranca/", ic: "◎", hint: "Assinaturas, Asaas e Cash Barber" },
    { key: "caderneta", label: "Caderneta", href: "/caderneta/", ic: "✎", hint: "Fiado e contas dos clientes" },
  ];
  var CUR = (window.GC_MODULE || "financas");
  var curMod = MODULES.filter(function (m) { return m.key === CUR; })[0] || MODULES[0];

  var css = ''
    + '.gcsw-chip{display:inline-flex;align-items:center;gap:5px;cursor:pointer;-webkit-user-select:none;user-select:none;'
    +   'font:600 12px/1 "Oswald","Arial Narrow",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;'
    +   'padding:4px 8px;border-radius:999px;border:1px solid rgba(128,128,128,.28);color:inherit;background:rgba(128,128,128,.10)}'
    + '.gcsw-chip:active{background:rgba(128,128,128,.22)}'
    + '.gcsw-chip .gcsw-car{font-size:9px;opacity:.7;transform:translateY(1px)}'
    + '.gcsw-ov{position:fixed;inset:0;z-index:9999;display:none;background:rgba(8,8,10,.55);'
    +   'backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);align-items:flex-end;justify-content:center}'
    + '.gcsw-ov.open{display:flex}'
    + '.gcsw-sheet{width:100%;max-width:440px;margin:0 10px calc(10px + env(safe-area-inset-bottom,0px));'
    +   'background:#161419;color:#f4f2f7;border:1px solid rgba(255,255,255,.10);border-radius:20px;'
    +   'box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;transform:translateY(12px);opacity:0;'
    +   'transition:transform .18s ease,opacity .18s ease}'
    + '.gcsw-ov.open .gcsw-sheet{transform:translateY(0);opacity:1}'
    + '.gcsw-h{padding:14px 18px 6px;font:600 11px/1 "Oswald",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8b8792}'
    + '.gcsw-it{display:flex;align-items:center;gap:13px;padding:14px 18px;text-decoration:none;color:#f4f2f7;border-top:1px solid rgba(255,255,255,.06)}'
    + '.gcsw-it:active{background:rgba(255,255,255,.05)}'
    + '.gcsw-ic{width:38px;height:38px;flex:none;border-radius:11px;display:grid;place-items:center;font-size:18px;'
    +   'background:linear-gradient(145deg,#c41e2a,#981320);color:#fff;box-shadow:0 2px 10px rgba(196,30,42,.5)}'
    + '.gcsw-it.inactive .gcsw-ic{background:rgba(255,255,255,.08);color:#cfcdd6;box-shadow:none}'
    + '.gcsw-tx{min-width:0}'
    + '.gcsw-nm{font:600 15px/1.15 "Oswald",sans-serif;letter-spacing:.02em}'
    + '.gcsw-hint{font:400 12px/1.2 system-ui,sans-serif;color:#9a97a3;margin-top:3px}'
    + '.gcsw-badge{margin-left:auto;font:600 10px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#1f9d57}'
    + '.gcsw-cancel{display:block;width:100%;background:none;border:none;border-top:1px solid rgba(255,255,255,.06);'
    +   'color:#9a97a3;font:600 14px/1 "Oswald",sans-serif;letter-spacing:.04em;padding:16px;cursor:pointer}';

  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

    // chip no título (dentro do .brand, se existir; senão, canto superior)
    var chip = document.createElement("span");
    chip.className = "gcsw-chip";
    chip.innerHTML = '<span class="gcsw-nm-ic">' + curMod.ic + "</span> " + curMod.label
      + ' <span class="gcsw-car">▼</span>';
    var brand = document.querySelector(".brand");
    if (brand) { brand.style.cursor = "pointer"; brand.appendChild(chip); brand.addEventListener("click", open); }
    else { chip.style.cssText += ";position:fixed;top:10px;left:10px;z-index:9998"; document.body.appendChild(chip); chip.addEventListener("click", open); }

    // overlay + sheet
    var ov = document.createElement("div"); ov.className = "gcsw-ov";
    var rows = MODULES.map(function (m) {
      var active = m.key === CUR;
      if (active) {
        return '<div class="gcsw-it inactive" style="opacity:.75"><span class="gcsw-ic">' + m.ic + '</span>'
          + '<span class="gcsw-tx"><span class="gcsw-nm">' + m.label + '</span>'
          + '<span class="gcsw-hint">' + m.hint + '</span></span><span class="gcsw-badge">Você está aqui</span></div>';
      }
      return '<a class="gcsw-it inactive" href="' + m.href + '"><span class="gcsw-ic">' + m.ic + '</span>'
        + '<span class="gcsw-tx"><span class="gcsw-nm">' + m.label + '</span>'
        + '<span class="gcsw-hint">' + m.hint + '</span></span></a>';
    }).join("");
    ov.innerHTML = '<div class="gcsw-sheet"><div class="gcsw-h">Trocar de módulo</div>'
      + rows + '<button class="gcsw-cancel" type="button">Fechar</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".gcsw-cancel").addEventListener("click", close);

    function open(e) { if (e) e.stopPropagation(); ov.classList.add("open"); }
    window.__gcswOpen = open;
    function close() { ov.classList.remove("open"); }
  }
  function open(e) { if (window.__gcswOpen) window.__gcswOpen(e); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
