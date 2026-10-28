# Abertura do dia — SQL pra rodar no Supabase (projeto do Finanças: ppzeyivfymntbisprxsb)

A "Abertura do dia" guarda, uma vez por dia, os dois relatórios enviados
(contratos ativos do Cash Barber + agenda do Retorno) numa tabela nova. Assim,
quem enviar **uma vez em qualquer aparelho** libera o dia pra **todos** os
aparelhos — ninguém precisa subir de novo.

Rode este SQL uma vez no **SQL Editor** do Supabase (projeto do Finanças) e
recarregue o app.

```sql
-- 1 linha por dia; subir de novo substitui (upsert pela data)
create table if not exists public.abertura_dia (
  data        date primary key,
  contratos   text,                 -- CSV dos contratos ativos (Cash Barber)
  agenda      text,                 -- CSV da agenda (Retorno)
  criado_por  text,
  criado_em   timestamptz not null default now()
);

alter table public.abertura_dia enable row level security;

-- só quem está logado pode ver e enviar
create policy "abertura_select_auth" on public.abertura_dia
  for select to authenticated using (true);
create policy "abertura_insert_auth" on public.abertura_dia
  for insert to authenticated with check (true);
create policy "abertura_update_auth" on public.abertura_dia
  for update to authenticated using (true) with check (true);
```

Se der erro dizendo que a policy já existe (código 42710), é porque já rodou
antes — pode ignorar, está tudo certo.

## Como funciona

- **Finanças** abre sempre, não depende de nada.
- **Retorno, Cobrança e Caderneta** ficam travados até o dia ser aberto. Na
  primeira vez do dia, aparece a tela "Abertura do dia" pedindo os dois CSVs.
  Depois de enviar, destravam os três — em qualquer aparelho naquele dia.
- Os dois arquivos ficam salvos aqui (texto). Cada aparelho lê a agenda e
  recalcula os "dias sem vir" com a data de hoje, e cruza os contratos com o
  Asaas ao vivo — então o dado é sempre atual.
- Da lista de contratos + agenda, o sistema monta o telefone de cada cliente e
  deixa um **botão de WhatsApp** na Caderneta, com mensagem de lembrete pronta.

Enquanto este SQL não for rodado, o app **não trava** — cada módulo continua
funcionando com o upload manual de sempre (como era antes).

## Limpeza (opcional, mais pra frente)

A tabela guarda 1 linha por dia. Se um dia quiser limpar o histórico antigo:

```sql
delete from public.abertura_dia where data < current_date - interval '30 days';
```
