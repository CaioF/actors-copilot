# 08 — Análise do Board Paper (14/10/2026)

> Documento analisado: *The Actors Copilot — Skool + Stripe Strategy, Final 2026‑10‑14* (13 páginas).
> Cópia em `docs/_referencias/board-paper-2026-10-14.pdf` (texto em `.txt` ao lado).
> Cruzamento com o código da branch `handoff/green-room-stripe-skool` e com os docs 05/06/07.

---

## 1. O que o documento é

Uma **peça de decisão** para a Tracey e para o time de implementação, com metodologia explícita:
tudo o que não tem suporte oficial documentado é classificado como **NOT SUPPORTED** e excluído da
baseline. Ele **não inspecionou** contas Stripe/Skool ao vivo, nem o código, nem os Zaps (diz isso na
seção de metodologia). Ou seja: é pesquisa de gabinete + contexto do projeto — e a parte técnica dele
descreve o *plano*, não o *estado*.

Autor não identificado no PDF. Endereçado a Tracey Collis e ao time de implementação.

---

## 2. Onde ele AJUDA (e ajuda bastante)

### 2.1 Dá a camada de governança que faltava

Nossos docs 05/06/07 respondem "como fazer". O paper responde "quem aprova o quê, com que risco e com
que teste de aceitação". Isso é o que a Tracey pediu ("do what is BEST, not EASIEST") e o que faltava
para destravar a decisão dela.

### 2.2 Confirma, com severidade, os dois riscos que achamos no código

| Achado nosso | O que o paper diz | Severidade dele |
|---|---|---|
| Cancelamento grava `community: 'none'` (`webhook/stripe/route.ts:289`) | "Founder loses lifetime access — Permanent founder flag; **never remove founder during app offboarding**" | 🔴 **CRITICAL** |
| `/upgrade` cria **segunda assinatura** no mesmo customer (`checkout/route.ts:128`) | "Skool + Stripe charge overlap — customer-success verifies cancellation and paid-through date; credit approved **before checkout**" | 🟠 **HIGH** |

O teste de aceitação mínimo dele é literal: **"Founding member Economy → cancel: Founder never loses
lifetime Green Room access."** Hoje o nosso código **falha** esse teste. Deixa de ser "detalhe de
implementação" e passa a ser gate de lançamento.

### 2.3 Traz tabelas fechadas que ainda não tínhamos

**Preços aprovados pela Tracey** (a fonte oficial — corrigem os links antigos):

| Produto | USD/mês | GBP/mês | EUR/mês | USD/ano | GBP/ano | EUR/ano |
|---|---:|---:|---:|---:|---:|---:|
| Green Room | $9 | £7 | €8 | $90 | £70 | €80 |
| Economy | $19 | £14 | €17 | $190 | £140 | €170 |
| Business | $29 | £22 | €26 | $290 | £220 | €260 |

**Preços de fundador** (derivados, *requerem aprovação da Tracey* para GBP/EUR):

| Assinatura | USD/mês | GBP/mês | EUR/mês | USD/ano | GBP/ano | EUR/ano |
|---|---:|---:|---:|---:|---:|---:|
| Founder Economy | $10 | £7 | €9 | $100 | £70 | €90 |
| Founder Business | $20 | £15 | €18 | $200 | £150 | €180 |

Isso fecha a pendência **0.2** do doc 07 (o desconto de fundador em GBP/EUR), que estava em aberto.

### 2.4 Corrige dois erros que estão no nosso código hoje

1. **"-20%" anual está errado.** O paper: "Two months free means 10 months paid at monthly rates
   (**about 16.7% off**), not 20% off. Correct inaccurate UI labels."
   No nosso código: `app/(interior)/upgrade/page.tsx:200` mostra `-20%`. **É um bug de comunicação
   comercial**, não de billing.
2. **Links antigos do Green Room com £9/€9 e £90/€90** conflitam com os £7/€8 e £70/€80 aprovados.
   Precisa substituir — é o Bloco 1 do doc 07.

### 2.5 Especifica o que "identidade" tem de significar

"Store app account ID, Stripe customer/subscription IDs, member email, the reported Skool account
email and a verified link or operator note. **Email equality alone is not strong proof** of the same
account. Do not claim Skool account merging is supported."

Hoje o nosso webhook resolve usuário por e-mail como fallback (camada 5) e o convite do Skool sai por
e-mail. Não há registro do e-mail da conta Skool nem nota de operador. Falta esse campo.

### 2.6 Dá donos e testes de aceitação

| Dono | Responsabilidade (proposta pelo paper) |
|---|---|
| Tracey | Aprovar preços, política de fundador, créditos e linguagem de migração |
| **Marcos** | **Configurar a oferta nativa no Skool** e preços/descontos no Stripe; verificar checkouts |
| Caio / dev | Implementar e testar regras de entitlement, identidades e tratamento de eventos |
| Raquel | Alinhar preços do site, seletores, destinos de checkout e jornada de confirmação |
| Community ops | Verificar cancelamentos no Skool; coordenar re-convites e offboarding |

---

## 3. Onde ele CONTRADIZ o nosso plano (o ponto mais importante)

### 🔴 O paper manda o Skool vender — o nosso doc 06 dizia o contrário

| | Doc 06 (nosso, 14/10) | Board paper (14/10) |
|---|---|---|
| Quem vende o Green Room | Só o Stripe. "O Skool fica como destino, **não como loja**." | **Skool vende nativamente** ($9/mês, $90/ano, **USD only**) como canal de aquisição |
| Quem vende Economy/Business | Stripe | Stripe (igual) |
| Papel do Skool | Hospedar + receber convite | Hospedar + receber convite **+ vender Green Room** |

**O motivo da mudança é comercial, e é forte:**
- membro pagante **nativo** pode deixar *review* de membro pagante; quem entra por convite grátis **não pode** [S3];
- **Growth Boost** só conta pagamento feito na plataforma [S1, S4];
- pagamento fora da plataforma é **penalidade de ranking** no Discovery [S4] — impacto não quantificado.

Ou seja: vender o $9 nativo não é por conveniência técnica, é por **aquisição**. O nosso doc 06 olhou
só para a billing e concluiu "Skool não deve vender"; o paper olha para o funil e conclui "Skool deve
vender, mas só o Green Room".

**Consequência prática:** sim, existem **dois canais vendendo o mesmo produto $9** (Skool nativo em USD
e Stripe no site em USD/GBP/EUR). O risco de sobreposição é real e o próprio paper o classifica como
**HIGH**, tratado por verificação humana + crédito antes do checkout.

### ⚠️ O paper exige gates de lançamento que nós ainda não cumprimos

"Do not approve: a production launch with unverified annual prices, mixed currencies or unresolved
member-invitation/offboarding handling."

Traduzindo para o nosso estado:

| Gate do paper | Nosso estado |
|---|---|
| Preços anuais verificados | ⚠️ `STRIPE_*_ANNUAL_PRICE_ID` existem no `env.example` mas o doc 07 registra configuração anual faltando / `currency_options` só com EUR |
| Moedas não misturadas | ❌ Green Room com £9/€9 (errado) e Economy/Business sem USD nem GBP |
| Convite resolvido e testado | ⚠️ o convite funciona, mas o filtro `active` bloqueia trials (doc 05 §5.4) |
| Offboarding resolvido | ❌ não existe: sem flag de fundador, `community` apagado no cancelamento |
| Sem segunda cobrança | ❌ `/upgrade` cria segunda assinatura |

**O paper diz explicitamente que a integração de convite "ainda precisa de teste ponta a ponta".**
Isso é o oposto de "já está pronto, é só publicar" — e é a linguagem que a Tracey provavelmente vai
usar de volta, porque foi este documento que ela recebeu.

---

## 4. O que ele acrescenta que não estava em nenhum doc nosso

1. **Canal nativo no Skool** (decisão de produto, não de código).
2. **Skool mantém a assinatura cancelada até o fim do período pago** — a conversão de pago para grátis
   exige **remoção + reconvite pelo admin**, e a pessoa precisa **aceitar** o convite [S5, S6].
3. **Política de migração Skool → Stripe**, dois caminhos: (A) fim do período; (B) imediato com
   **crédito único de sobreposição**.
4. **Governança de desconto**: código de promoção **atrelado ao cliente**, **uso único**, com validade.
   Fundador = desconto **recorrente** e distinto. **Não empilhar** incentivos.
5. **Crédito por moeda**: cupom de valor em USD **não** vira automaticamente o mesmo desconto em GBP/EUR.
6. **Plano anual**: não assumir que o valor não usado = uma mensalidade de $9; reconciliar o período
   pré-pago.
7. **Tabela de preços de fundador em GBP/EUR** (seção 2.3 acima).
8. **Lista de métricas separadas**: nativo Skool × site Stripe × qualidade da migração.
9. **Quatro assinaturas pedidas à Tracey**: product ownership, política de migração, preço de fundador,
   operação de lançamento.

---

## 5. Impacto direto no código (o que fazer por causa do paper)

| # | Item | Onde | Por que o paper obriga |
|---|---|---|---|
| 1 | **Flag permanente de fundador** + nunca rebaixar no offboarding | `lib/billing.ts` + webhook | risco **CRITICAL** |
| 2 | **Preservar `community` no cancelamento** (remover o `isDeleted ? 'none'`) | `app/api/webhooks/stripe/route.ts:289` | teste "Founder never loses lifetime Green Room access" |
| 3 | **Impedir segunda assinatura** no upgrade (portal configurado ou `subscriptions.update` com proration) | `app/(interior)/upgrade/page.tsx` + `checkout/route.ts` | risco HIGH de sobreposição |
| 4 | **Corrigir o rótulo `-20%`** → 16,7% / "2 meses grátis" | `app/(interior)/upgrade/page.tsx:200` | correção pedida explicitamente |
| 5 | **Corrigir £7/€8 e £70/€80** do Green Room; adicionar USD/GBP em Economy/Business | Stripe + links | preços aprovados |
| 6 | **Registrar e-mail da conta Skool + nota de operador** | Firestore | "email equality alone is not proof" |
| 7 | **Idempotência por `event.id`** | webhook | evita convite duplicado |
| 8 | **Filtro do Zap aceitar `trialing`** | Zapier | senão Economy/Business em trial não recebem convite |
| 9 | **Crédito de migração** (cupom atrelado, uso único, por moeda) | Stripe | política de migração |
| 10 | **Configurar a oferta nativa de $9 no Skool** | Skool | decisão GO do paper — e está atribuída ao **Marcos** |

---

## 6. Leituras divergentes que precisam de uma decisão sua

1. **Skool vende o Green Room nativamente, sim ou não?** O paper diz sim (aquisição/reviews/Growth
   Boost). O nosso doc 06 disse não (risco de cobrança dupla). **Não dá para ter os dois docs válidos.**
   Se for sim, entra trabalho novo: configurar a oferta no Skool e tratar a migração Skool → Stripe.
2. **O convite está pronto ou precisa de teste ponta a ponta?** Você diz pronto; o paper diz que precisa
   de teste. Os dois cabem: o caminho de $9 sem trial está testado, o de trial **não**.
3. **Lançar agora ou cumprir os gates?** Você quer publicar; o paper pede preços anuais verificados,
   moedas alinhadas e offboarding resolvido antes. Os itens 1, 2, 3 e 4 da seção 5 são baratos; o item 10
   é o caro.

---

## 7. Recomendação

Aproveitar o paper como **especificação de negócio** (ele é bom nisso) e não como **estado técnico**
(ele não inspecionou nada). Na prática:

1. Fechar os itens **1, 2, 3 e 8** da seção 5 — são o que transforma "quase pronto" em "pode publicar"
   sem violar nenhum gate do paper.
2. Corrigir os itens **4, 5** antes de divulgar link (são visíveis ao cliente).
3. Decidir com a Tracey o item **10** (Skool nativo): é a maior decisão de produto em aberto e o paper a
   atribui a você.
4. Responder à Tracey usando a linguagem do próprio paper — inclusive os quatro sign-offs. Ela vai
   reconhecer o documento e a conversa deixa de ser "confie em mim".
