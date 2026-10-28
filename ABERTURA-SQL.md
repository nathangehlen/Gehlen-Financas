# Abertura do dia — como está montado

Os dois relatórios do dia (contratos ativos do Cash Barber + agenda do Retorno)
**ficam só no Google Drive** — nada é guardado no Supabase (pra não ocupar
espaço). Quando qualquer aparelho abre o dia, o app pergunta pra Edge Function
`to-drive` se os arquivos de hoje já estão no Drive; se estiverem, ela lê e
devolve o conteúdo; se não, aparece a tela "Abertura do dia" pedindo os 2
arquivos, que são enviados pro Drive.

**Não precisa de tabela nova no banco.** (Se em algum momento a tabela
`abertura_dia` chegou a ser criada, pode apagar — não é usada.)

## Setup (uma vez)

> **Importante:** quem grava no Drive é um **Apps Script** do próprio Nathan
> (roda como ele, tem cota). A conta de serviço NÃO serve pra gravar numa conta
> Gmail pessoal (erro 403 "Service Accounts do not have storage quota").

1. **Apps Script** novo em script.google.com, com o código de
   `google-apps-script/CodigoGS.gs`. Publicar como **App da Web**:
   Executar como **EU (Nathan)**, Acesso **Qualquer pessoa**. Copiar a URL `/exec`.
2. Secret no Supabase: **`APPS_SCRIPT_URL`** = essa URL `/exec`.
3. Edge Function **`to-drive`** publicada (código em
   `supabase/functions/to-drive/index.ts`). Agora é só uma **ponte**: repassa
   `action:"put"` e `action:"get"` pro Apps Script.
4. (A API do Google Drive precisa estar ativada no projeto do Google — foi o que
   faltava no primeiro teste.)

## Pastas no Drive

Projeto Gehlens Club → **Relatórios do app (central)**:
- `1 - Contratos ativos (Cash Barber)` — id 1Fc3rYj-1vJlz6TrEHbcIuSTZKVN69awb
- `2 - Agenda / Retorno` — id 1SWshe99UwXszwhS7_nZ8fve0K-rwhrjf
- `3 - Extratos Sicoob (empresa)` — id 19oX7m_P048HODo33auJFDj12JwqMRGQb
- `4 - Extratos Banco Neon (PF)` — id 1v542qwI_FcP2QEkyV1YaFJ7-DDwrDIxq

## Observações

- Finanças abre sempre (não depende de nada). Retorno/Cobrança/Caderneta ficam
  travados até o dia ser aberto.
- Cada aparelho lê a agenda e recalcula os "dias sem vir" com a data de hoje, e
  cruza os contratos com o Asaas ao vivo — dado sempre atual.
- Se a função não estiver publicada ou o Drive não responder, o app **não
  trava**: cada módulo segue com o upload manual de sempre.
- Os arquivos são nomeados com a data (ex.: `2026-10-28 - arquivo.csv`), então
  fica o histórico por dia nas pastas.
