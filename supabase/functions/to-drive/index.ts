// Supabase Edge Function: to-drive
// -----------------------------------------------------------------------------
// Agora é só uma PONTE: repassa o pedido do app pro Apps Script do Nathan
// (google-apps-script/CodigoGS.gs), que roda COMO ele e tem cota pra salvar no
// Drive. A conta de serviço não servia pra GRAVAR numa conta Gmail pessoal
// (erro 403 "Service Accounts do not have storage quota").
//
// Precisa do secret:  APPS_SCRIPT_URL  = a URL /exec do App da Web publicado.
//
// O app continua chamando igual:
//   sb.functions.invoke("to-drive", { body: { action:"put", tipo, filename, mime, base64 } })
//   sb.functions.invoke("to-drive", { body: { action:"get", today:"2026-10-28" } })
// -----------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  try {
    const url = Deno.env.get("APPS_SCRIPT_URL");
    if (!url) return json({ error: "APPS_SCRIPT_URL ausente (configure o secret)" }, 500);

    const body = await req.text();
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
    });
    const txt = await r.text();

    // Se o Apps Script devolveu {error:...} (ou a chamada falhou), responde
    // como erro, pra o app tratar como falha (e não achar que salvou).
    let hasError = !r.ok;
    try { const j = JSON.parse(txt); if (j && j.error) hasError = true; } catch { /* resposta não-JSON = erro */ hasError = true; }

    return new Response(txt, {
      status: hasError ? 502 : 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
