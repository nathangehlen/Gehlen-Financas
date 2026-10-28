// Supabase Edge Function: to-drive
// -----------------------------------------------------------------------------
// Recebe um arquivo (em base64) e envia pra pasta certa do Google Drive da
// barbearia, usando uma CONTA DE SERVIÇO do Google. A chave da conta fica no
// secret GDRIVE_SA_KEY (o JSON inteiro que você baixou no Google Cloud).
//
// Deploy: Supabase → Edge Functions → nova função "to-drive" → cola este código.
// Secret: GDRIVE_SA_KEY = conteúdo do .json da conta de serviço.
// As 4 pastas precisam estar compartilhadas (Editor) com o e-mail da conta.
//
// Chamada (do app): sb.functions.invoke("to-drive", { body: {
//   tipo: "contratos" | "agenda" | "sicoob" | "neon",
//   filename: "2026-10-28 - arquivo.csv",
//   mime: "text/csv",
//   base64: "<arquivo em base64>"
// }})
// -----------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// IDs das pastas no Drive (Projeto Gehlens Club → Relatórios do app (central))
const FOLDERS: Record<string, string> = {
  contratos: "1Fc3rYj-1vJlz6TrEHbcIuSTZKVN69awb",
  agenda:    "1SWshe99UwXszwhS7_nZ8fve0K-rwhrjf",
  sicoob:    "19oX7m_P048HODo33auJFDj12JwqMRGQb",
  neon:      "1v542qwI_FcP2QEkyV1YaFJ7-DDwrDIxq",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromStr(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return b64ToBytes(body).buffer;
}

// Pega um access_token do Google a partir da conta de serviço (JWT RS256)
async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const unsigned = b64urlFromStr(JSON.stringify(header)) + "." + b64urlFromStr(JSON.stringify(claim));
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const jwt = unsigned + "." + b64urlFromBytes(sig);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("token google: " + JSON.stringify(j));
  return j.access_token;
}

// Envia o arquivo pro Drive (multipart/related: metadados + conteúdo)
async function uploadToDrive(token: string, folderId: string, name: string, mime: string, bytes: Uint8Array) {
  const boundary = "gcsep" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name, parents: [folderId] });
  const enc = new TextEncoder();
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + bytes.length + post.length);
  body.set(pre, 0); body.set(bytes, pre.length); body.set(post, pre.length + bytes.length);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "multipart/related; boundary=" + boundary },
    body,
  });
  const j = await res.json();
  if (!res.ok) throw new Error("upload drive: " + JSON.stringify(j));
  return j;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  try {
    const { tipo, filename, mime, base64 } = await req.json();
    const folderId = FOLDERS[String(tipo)];
    if (!folderId) return json({ error: "tipo invalido: " + tipo }, 400);
    if (!base64) return json({ error: "sem arquivo" }, 400);
    const sa = JSON.parse(Deno.env.get("GDRIVE_SA_KEY") || "{}");
    if (!sa.client_email || !sa.private_key) throw new Error("GDRIVE_SA_KEY ausente ou invalido");
    const token = await getAccessToken(sa);
    const r = await uploadToDrive(token, folderId, filename || ("arquivo-" + Date.now()), mime || "application/octet-stream", b64ToBytes(base64));
    return json({ ok: true, id: r.id, name: r.name });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
