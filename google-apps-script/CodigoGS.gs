/**
 * Apps Script "ponte do Drive" da Gehlen's Club.
 * --------------------------------------------------------------------------
 * Roda COMO o Nathan (dono do Drive), então tem espaço pra salvar os arquivos
 * — ao contrário da conta de serviço, que não tem cota e dá erro 403
 * "Service Accounts do not have storage quota" em conta Gmail pessoal.
 *
 * A função to-drive (Supabase) repassa as chamadas pra cá. Duas ações:
 *   - action "put": salva um arquivo (base64) na pasta certa.
 *   - action "get": lê os arquivos do dia (contratos + agenda) e diz se hoje
 *                   é dia de extrato (a cada 3 dias).
 *
 * Publicar como App da Web: Implantar > Nova implantação > Tipo "App da Web" >
 *   Executar como: EU (nathanmorays@gmail.com)
 *   Quem pode acessar: Qualquer pessoa
 *   -> copiar a URL /exec e pôr no secret APPS_SCRIPT_URL do Supabase.
 * --------------------------------------------------------------------------
 */

var FOLDERS = {
  contratos: "1Fc3rYj-1vJlz6TrEHbcIuSTZKVN69awb",
  agenda:    "1SWshe99UwXszwhS7_nZ8fve0K-rwhrjf",
  sicoob:    "19oX7m_P048HODo33auJFDj12JwqMRGQb",
  neon:      "1v542qwI_FcP2QEkyV1YaFJ7-DDwrDIxq"
};

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var action = body.action || "put";

    if (action === "get") {
      var marca = String(body.today || "");
      if (!marca) return json({ error: "sem data (today)" });
      var contratos = readLatest(FOLDERS.contratos, marca);
      var agenda = readLatest(FOLDERS.agenda, marca);
      var lastSic = latestDate(FOLDERS.sicoob);
      var lastNeon = latestDate(FOLDERS.neon);
      var lastExtrato = [lastSic, lastNeon].filter(String).sort().pop() || "";
      var extratoDay = !lastExtrato || daysBetween(lastExtrato, marca) >= 3;
      return json({ ok: true, has: !!(contratos && agenda), contratos: contratos, agenda: agenda, extratoDay: extratoDay, extratoLast: lastExtrato });
    }

    // action "put"
    var folderId = FOLDERS[String(body.tipo)];
    if (!folderId) return json({ error: "tipo invalido: " + body.tipo });
    if (!body.base64) return json({ error: "sem arquivo" });
    var bytes = Utilities.base64Decode(body.base64);
    var blob = Utilities.newBlob(bytes, body.mime || "application/octet-stream", body.filename || ("arquivo-" + Date.now()));
    var file = DriveApp.getFolderById(folderId).createFile(blob);
    return json({ ok: true, id: file.getId(), name: file.getName() });
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  }
}

// Permite um GET simples no navegador só pra testar se publicou certo.
function doGet() {
  return json({ ok: true, ping: "ponte do Drive no ar" });
}

// Acha o arquivo mais recente de uma pasta cujo nome contém "marca" e devolve o texto.
function readLatest(folderId, marca) {
  var files = DriveApp.getFolderById(folderId).getFiles();
  var best = null;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf(marca) >= 0) {
      if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
    }
  }
  return best ? best.getBlob().getDataAsString() : "";
}

// Data (YYYY-MM-DD) do arquivo mais recente de uma pasta, pelo nome. "" se vazio.
function latestDate(folderId) {
  var files = DriveApp.getFolderById(folderId).getFiles();
  var best = null;
  while (files.hasNext()) {
    var f = files.next();
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  if (!best) return "";
  var m = best.getName().match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function daysBetween(a, b) {
  var da = new Date(a + "T00:00:00Z").getTime(), db = new Date(b + "T00:00:00Z").getTime();
  if (isNaN(da) || isNaN(db)) return 9999;
  return Math.round((db - da) / 86400000);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
