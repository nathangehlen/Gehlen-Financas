# App unificado — Gehlen's Club

Um app só, com três abas trocáveis por um seletor no topo (toca no nome → escolhe):

- **Finanças** — `/` (app atual, praticamente intacto; é a "casa")
- **Retorno** — `/retorno/` (monitor de clientes sumidos; por enquanto é um placeholder)
- **Cobrança** — `/cobranca/` (painel Asaas + Cash Barber; agora aponta pro Supabase de Finanças)

O seletor é o `switch.js` (um arquivo só, incluído nas três páginas). Login é único: as três
páginas usam o **mesmo projeto Supabase** (`ppzeyivfymntbisprxsb`) na **mesma origem**, então
entrar numa vale pras outras.

## O que ainda precisa ser feito no Supabase de Finanças (projeto ppzeyivfymntbisprxsb)

A aba Cobrança só funciona 100% depois destes passos (feitos por quem tem acesso ao painel):

1. **Criar a tabela de lembretes** (SQL Editor):

   ```sql
   create table if not exists public.lembretes (
     email text primary key,
     texto text,
     ts    bigint
   );
   alter table public.lembretes enable row level security;
   ```
   (a função acessa via service role, então não precisa de policy pública)

2. **Publicar a Edge Function `reconciliar`** neste projeto (código em
   `/mnt/project-files/unificacao/cobranca-backend/reconciliar.ts`). Manter `verify_jwt = on`.

3. **Definir o segredo** `ASAAS_API_KEY` (copiar o valor do projeto antigo de cobrança,
   em Edge Functions → Secrets). `ASAAS_BASE` é opcional.

4. **(Opcional) Copiar os lembretes atuais** do projeto antigo pra tabela nova.

Enquanto 1–3 não estiverem prontos, Finanças e Retorno já funcionam; a aba Cobrança abre,
mas as listas dependem da função publicada aqui.
