/* ============================================================================
 * abertura.js — "Abertura do dia" (Gehlen's Club)
 * --------------------------------------------------------------------------
 * Na primeira vez que o dia é aberto (em QUALQUER aparelho), pede dois arquivos:
 *   1) Contratos ativos (Cash Barber)   2) Agendamentos / agenda (Retorno)
 * Os dois ficam SÓ no Google Drive (via Edge Function to-drive). Qualquer aparelho
 * que abrir naquele dia pergunta ao Drive se já tem os arquivos de hoje; se tiver,
 * pega tudo pronto — não precisa subir de novo. Finanças carrega este arquivo mas
 * a tela é pulável lá ("Agora não"); Retorno, Cobrança e Caderneta ficam travados
 * até o dia ser aberto.
 *
 * Cada módulo pode definir window.GConAbertura = function({contratos, agenda}){...}
 * que é chamado assim que os dados do dia estão prontos (do banco ou recém-subidos).
 * Antes de chamar, este arquivo já grava os caches locais usados por todos:
 *   - gc_assinantes  (quem é assinante + plano — igual ao que a Cobrança grava)
 *   - gc_fones       (nome/telefone -> WhatsApp, pra Caderneta e Retorno)
 *
 * Se não dá pra confirmar que os arquivos do dia já estão no Drive (função fora
 * do ar, erro, offline), ele MOSTRA a tela de abertura (pede os arquivos) em vez
 * de abrir sem pedir — nos módulos sempre pede; no Financeiro dá pra pular.
 * ==========================================================================*/
(function () {
  "use strict";
  var SB_URL = "https://ppzeyivfymntbisprxsb.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwemV5aXZmeW1udGJpc3ByeHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjE0MDcsImV4cCI6MjEwNjc5NzQwN30.bnr2FU-oOnuXlhiKcMZGgOiP0r1Dp0UDYOhRChGWE1Y";

  function todayYMD() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function fmtBRdate(ymd) { var m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function telKey(x) { var d = String(x || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : d; }
  function normTel(tel) {
    var d = String(tel || "").replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.indexOf("55") === 0) d = d.slice(2); // tira código do país
    if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);                         // faltou o 9º dígito
    return { wa: "55" + d, ok: d.length === 11 };
  }
  function normName(n) {
    return String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  // Finanças (home) = tela some ao clicar "agora não"; nos módulos, leva pro Financeiro
  function isHome() { return !/\/(retorno|cobranca|caderneta)(\/|$)/.test(location.pathname); }

  // "Nome - (DDD) 99999-9999 - email" -> {nome, tel}
  function parseCliente(c) {
    var parts = String(c || "").split(" - ").map(function (p) { return p.trim(); });
    var nome = parts[0] || "";
    var tel = parts.find(function (p) { return /\d{4,}/.test(p) && p.indexOf("@") < 0; }) || "";
    return { nome: nome, tel: tel };
  }

  function parseCSV(text) {
    try {
      var res = window.Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
      return (res && res.data) || [];
    } catch (e) { return []; }
  }

  // Grava gc_assinantes a partir dos contratos (mesma forma que a Cobrança usa)
  function stashAssinantes(rows) {
    try {
      var fk = function (x) { return telKey(x); };
      var em = function (x) { return String(x || "").trim().toLowerCase(); };
      var byPhone = {}, byEmail = {}, n = 0;
      (rows || []).forEach(function (r) {
        var plano = String(r["Plano"] || r.plano || "").trim();
        if (!plano || /Totalizado|R\$/i.test(plano)) return; // pula linhas de total
        var o = { plano: plano, nome: String(r["Cliente"] || r.nome || "").trim() };
        var p = fk(r["Telefone"] || r.telefone); if (p) byPhone[p] = o;
        var e = em(r["Email"] || r.email); if (e) byEmail[e] = o;
        n++;
      });
      if (n) localStorage.setItem("gc_assinantes", JSON.stringify({ updated: Date.now(), count: n, byPhone: byPhone, byEmail: byEmail }));
    } catch (e) {}
  }

  // Monta o mapa nome/telefone -> WhatsApp, cruzando os dois arquivos
  function buildFones(contratosRows, agendaRows) {
    var byKey = {}, byName = {};
    function add(nome, tel) {
      nome = String(nome || "").trim(); if (!tel) return;
      var nt = normTel(tel); if (!nt.wa || nt.wa.length < 12) return;
      var k = telKey(tel); var o = { wa: nt.wa, ok: nt.ok, tel: String(tel).trim(), nome: nome };
      if (k && !byKey[k]) byKey[k] = o;
      var nn = normName(nome); if (nn && !byName[nn]) byName[nn] = o;
    }
    (contratosRows || []).forEach(function (r) {
      var plano = String(r["Plano"] || r.plano || "").trim();
      if (/Totalizado|R\$/i.test(plano)) return;
      add(r["Cliente"] || r.nome, r["Telefone"] || r.telefone);
    });
    (agendaRows || []).forEach(function (r) {
      var cli = r["Cliente"] || r.cliente || r.Cliente;
      // a coluna "Cliente" da agenda pode ter nome diferente; tenta achar algo com telefone embutido
      if (!cli) { for (var kk in r) { if (/cliente/i.test(kk)) { cli = r[kk]; break; } } }
      var pc = parseCliente(cli); add(pc.nome, pc.tel);
    });
    try { localStorage.setItem("gc_fones", JSON.stringify({ date: todayYMD(), byKey: byKey, byName: byName })); } catch (e) {}
    return { byKey: byKey, byName: byName };
  }

  // Aplica os dados do dia: grava caches e avisa o módulo
  function aplicar(contratosText, agendaText) {
    var cRows = parseCSV(contratosText || "");
    var aRows = parseCSV(agendaText || "");
    stashAssinantes(cRows);
    buildFones(cRows, aRows);
    try {
      localStorage.setItem("gc_raw_contratos", JSON.stringify({ date: todayYMD(), text: contratosText || "" }));
      localStorage.setItem("gc_raw_agenda", JSON.stringify({ date: todayYMD(), text: agendaText || "" }));
      localStorage.setItem("gc_abertura", JSON.stringify({ date: todayYMD() }));
    } catch (e) {}
    try { if (typeof window.GConAbertura === "function") window.GConAbertura({ contratos: contratosText || "", agenda: agendaText || "" }); } catch (e) {}
  }

  /* ---------- overlay ---------- */
  var ov = null;
  function injectCSS() {
    if (document.getElementById("gcab-css")) return;
    var st = document.createElement("style"); st.id = "gcab-css";
    st.textContent = ''
      + '.gcab-ov{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;'
      +   'background:var(--bg,#0a0809);overflow:auto}'
      + '.gcab-box{width:100%;max-width:420px;background:var(--surface,#18141a);color:var(--fg,#f5f3f6);'
      +   'border:1px solid var(--line,#2a242d);border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
      + '.gcab-box h2{font-family:var(--head,"Oswald",sans-serif);text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;font-size:1.25rem}'
      + '.gcab-box .gcab-s{color:var(--muted,#9a949e);font-size:.85rem;margin:0 0 16px;line-height:1.45}'
      + '.gcab-f{border:1px dashed var(--line,#2a242d);border-radius:11px;padding:13px;margin-bottom:10px;background:var(--surface-2,#201b22)}'
      + '.gcab-f .gcab-t{font-weight:600;font-size:.9rem;margin-bottom:3px}'
      + '.gcab-f .gcab-h{color:var(--muted,#9a949e);font-size:.76rem;margin-bottom:9px}'
      + '.gcab-f.ok{border-style:solid;border-color:var(--green,#37c47e)}'
      + '.gcab-f input[type=file]{width:100%;font-size:.82rem;color:var(--muted,#9a949e)}'
      + '.gcab-done{color:var(--green,#37c47e);font-size:.8rem;font-weight:600;margin-top:7px}'
      + '.gcab-btn{width:100%;background:linear-gradient(135deg,var(--accent,#df2531),var(--accent-ink,#9c1620));color:#fff;border:none;'
      +   'border-radius:999px;padding:13px;font-family:var(--head,"Oswald",sans-serif);text-transform:uppercase;letter-spacing:.5px;'
      +   'font-weight:600;font-size:.95rem;cursor:pointer;margin-top:6px}'
      + '.gcab-btn:disabled{opacity:.5;cursor:not-allowed}'
      + '.gcab-err{color:var(--red,#e5414c);font-size:.8rem;min-height:18px;margin-top:8px;text-align:center}'
      + '.gcab-back{display:block;width:100%;text-align:center;background:none;border:none;color:var(--muted,#9a949e);'
      +   'font:600 .82rem/1 var(--head,"Oswald",sans-serif);letter-spacing:.04em;padding:14px 0 2px;cursor:pointer;text-decoration:none}';
    document.head.appendChild(st);
  }
  function showOverlay(sb) {
    injectCSS();
    if (ov) return;
    ov = document.createElement("div"); ov.className = "gcab-ov";
    ov.innerHTML = ''
      + '<div class="gcab-box">'
      + '  <h2>Abertura do dia</h2>'
      + '  <p class="gcab-s">Pra abrir <b>Retorno</b>, <b>Cobrança</b> e <b>Caderneta</b> hoje, envie os dois relatórios do dia. '
      +      'É só uma vez — depois disso qualquer aparelho já abre pronto.</p>'
      + '  <div class="gcab-f" id="gcab-f1"><div class="gcab-t">1 · Contratos ativos (Cash Barber)</div>'
      +      '<div class="gcab-h">O mesmo CSV que você sobe na Cobrança.</div>'
      +      '<input type="file" id="gcab-i1" accept=".csv,text/csv"><div class="gcab-done" id="gcab-d1" style="display:none"></div></div>'
      + '  <div class="gcab-f" id="gcab-f2"><div class="gcab-t">2 · Agendamentos / agenda</div>'
      +      '<div class="gcab-h">O relatório da agenda que o Retorno usa.</div>'
      +      '<input type="file" id="gcab-i2" accept=".csv,text/csv"><div class="gcab-done" id="gcab-d2" style="display:none"></div></div>'
      + '  <button class="gcab-btn" id="gcab-go" disabled>Liberar o dia</button>'
      + '  <div class="gcab-err" id="gcab-err"></div>'
      + (isHome()
          ? '  <button class="gcab-back" id="gcab-skip" type="button">Agora não — ir pro Financeiro</button>'
          : '  <a class="gcab-back" href="/">Agora não — ir pro Financeiro</a>')
      + '</div>';
    document.body.appendChild(ov);
    var skip = ov.querySelector("#gcab-skip");
    if (skip) skip.addEventListener("click", function () { removeOverlay(); }); // no Financeiro, só fecha a tela

    var t1 = null, t2 = null; // cada um: {text, base64, name, mime}
    var i1 = ov.querySelector("#gcab-i1"), i2 = ov.querySelector("#gcab-i2");
    var go = ov.querySelector("#gcab-go"), err = ov.querySelector("#gcab-err");
    function readFile(input, cb) {
      var f = input.files[0]; if (!f) { cb(null); return; }
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var buf = new Uint8Array(rd.result);
          var text = new TextDecoder("utf-8").decode(buf);
          var bin = ""; for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          cb({ text: text, base64: btoa(bin), name: f.name, mime: f.type || "text/csv" });
        } catch (e) { cb(null); }
      };
      rd.onerror = function () { cb(null); };
      rd.readAsArrayBuffer(f);
    }
    function refresh() { go.disabled = !(t1 && t2); }
    i1.addEventListener("change", function () {
      readFile(i1, function (o) {
        t1 = o; var f = ov.querySelector("#gcab-f1"), d = ov.querySelector("#gcab-d1");
        if (o) { f.classList.add("ok"); d.style.display = "block"; d.textContent = "✓ " + (o.name || "arquivo"); }
        refresh();
      });
    });
    i2.addEventListener("change", function () {
      readFile(i2, function (o) {
        t2 = o; var f = ov.querySelector("#gcab-f2"), d = ov.querySelector("#gcab-d2");
        if (o) { f.classList.add("ok"); d.style.display = "block"; d.textContent = "✓ " + (o.name || "arquivo"); }
        refresh();
      });
    });
    go.addEventListener("click", function () {
      if (!t1 || !t2) return;
      go.disabled = true; go.textContent = "Salvando…"; err.textContent = "";
      // guarda os dois arquivos direto no Google Drive (nada fica no Supabase)
      Promise.all([putDrive(sb, "contratos", t1), putDrive(sb, "agenda", t2)]).then(function (rs) {
        var bad = rs.find(function (r) { return !r || r.error; });
        if (bad) {
          go.disabled = false; go.textContent = "Liberar o dia";
          err.textContent = "Não consegui salvar no Drive. Confere se a função 'to-drive' foi publicada e o secret GDRIVE_SA_KEY está certo.";
          return;
        }
        aplicar(t1.text, t2.text);
        removeOverlay();
      }).catch(function (e) {
        go.disabled = false; go.textContent = "Liberar o dia";
        err.textContent = "Falha de conexão ao salvar. Tente de novo.";
      });
    });
  }

  // Guarda o arquivo no Google Drive (via Edge Function to-drive, action "put").
  // Devolve a promise do invoke pra quem chamou saber se deu certo.
  function putDrive(sb, tipo, o) {
    var nome = todayYMD() + " - " + ((o && o.name) || (tipo + ".csv"));
    return sb.functions.invoke("to-drive", { body: { action: "put", tipo: tipo, filename: nome, mime: (o && o.mime) || "text/csv", base64: o && o.base64 } });
  }
  function removeOverlay() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); ov = null; }

  /* ---------- boot ---------- */
  function boot() {
    if (!window.supabase || !window.Papa) return; // precisa das libs
    var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    var ran = false;
    function decidir(session) {
      if (ran) return; // roda a decisão uma vez por carga
      if (!(session && session.user)) return; // sem login, o gate de login do módulo cobre a tela
      ran = true;
      window.GCAB_ME = (session.user && session.user.email) || "";
      // pergunta pro Drive (via função) se os arquivos de hoje já estão lá
      sb.functions.invoke("to-drive", { body: { action: "get", today: todayYMD() } }).then(function (r) {
        if (r && r.error) {
          // função fora do ar ou erro: em vez de abrir sem pedir, mostra a tela (pede os arquivos)
          console.warn("[abertura] erro ao ler do Drive:", (r.error && r.error.message) || r.error);
          showOverlay(sb);
          return;
        }
        var d = r && r.data;
        if (d && d.has) {
          aplicar(d.contratos || "", d.agenda || "");
          removeOverlay();
        } else {
          showOverlay(sb); // ninguém abriu o dia ainda
        }
      }).catch(function (e) { console.warn("[abertura] falha:", e); showOverlay(sb); });
    }
    sb.auth.getSession().then(function (r) { decidir(r.data && r.data.session); }).catch(function () {});
    sb.auth.onAuthStateChange(function (_e, session) { decidir(session); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
