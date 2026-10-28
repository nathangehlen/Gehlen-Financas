# Caderneta — SQL pra rodar no Supabase (projeto do Finanças: ppzeyivfymntbisprxsb)

A aba Caderneta guarda tudo numa tabela nova, pra os dados **nunca se perderem**
e valerem em qualquer aparelho. Rode este SQL uma vez no **SQL Editor** do Supabase
(projeto do Finanças), depois recarregue a aba.

```sql
-- tabela da caderneta (fiado / contas dos clientes)
create table if not exists public.caderneta (
  id          uuid primary key default gen_random_uuid(),
  cliente     text not null,
  tel         text,
  tipo        text not null check (tipo in ('deve','favor','pagou')),
  valor       numeric(10,2) not null check (valor >= 0),
  descricao   text,
  vence_em    date,
  criado_por  text,
  criado_em   timestamptz not null default now()
);

create index if not exists caderneta_tel_idx    on public.caderneta (tel);
create index if not exists caderneta_criado_idx on public.caderneta (criado_em);

-- só quem está logado pode ver e lançar (a chave pública/anon sozinha não acessa)
alter table public.caderneta enable row level security;

create policy "caderneta_select_auth" on public.caderneta
  for select to authenticated using (true);
create policy "caderneta_insert_auth" on public.caderneta
  for insert to authenticated with check (true);
```

## Atualização 28/10 — data de cobrança

Se a tabela já existe (criada antes), rode só isto pra adicionar a coluna da
data em que o cliente vai pagar:

```sql
alter table public.caderneta add column if not exists vence_em date;
```

(Quem for criar a tabela do zero agora pelo bloco acima: rode também este ALTER,
ou adicione `vence_em date` na criação.)

Notas:
- `tipo`: `deve` (o cliente pegou algo / está devendo), `favor` (crédito a favor dele),
  `pagou` (baixa de pagamento). O saldo de cada cliente = soma dos `deve` menos
  `favor` menos `pagou`.
- Deixei **sem** permissão de apagar/editar de propósito (append-only), pra não
  perder histórico. Se um dia quiserem permitir corrigir/estornar, a gente adiciona
  uma policy de update/delete ou um botão de "estorno" (lançamento que anula).
