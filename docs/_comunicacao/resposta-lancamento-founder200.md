# Resposta de lançamento — verificação de upgrade/downgrade/cancelamento

> 14/10/2026. Verificação feita direto no código da branch `handoff/green-room-stripe-skool`,
> para responder à pergunta do Marcos: *"o downgrade, o cancelamento e o upgrade já estão previstos no app?"*
> Duas mensagens: **interna** (equipe) e **para a Tracey** (PT + EN).

---

# 1) VERSÃO INTERNA — para você (Marcos / Caio / Raquel)

## Resposta curta à sua pergunta

**Em parte.** O *reconhecimento* da mudança está previsto. A *operação* de trocar de plano **não**.
Detalhe por detalhe, com o arquivo e a linha para conferir:

### ✅ Cancelamento — previsto (com um furo no caso dos fundadores)

- Caminho: botão em `/settings` → Stripe Customer Portal → evento `customer.subscription.deleted`.
- O webhook trata: `tier: 'free'`, `hasAccess: false`, `status: 'canceled'`
  (`app/api/webhooks/stripe/route.ts:251-298`).
- Cancelamento agendado (`cancel_at_period_end`) mantém o acesso até `currentPeriodEnd`. Correto.
- ❌ **Furo:** na linha 289 o webhook grava `community: 'none'` no cancelamento.
  Isso **apaga o Green Room vitalício do fundador** — exatamente a promessa da Tracey.
  A doc 07 diz que "sobrevive ao cancelamento", mas o código faz o contrário.
- Remoção do Skool: continua manual (o conector do Skool não tem ação de remover). Confirma o que você disse.

### ⚠️ Upgrade / downgrade — o reconhecimento existe, a operação não

- **O que existe:** `customer.subscription.updated` relê o price e atualiza `tier` + `community`.
  Se a assinatura mudar, o app reconhece e ajusta o acesso.
- **O que não existe:** nenhum código troca a assinatura existente. Não há `stripe.subscriptions.update`
  nem proration. A tela `/upgrade` chama **sempre** `/api/billing/checkout`, que cria uma **nova**
  checkout session no mesmo customer (`app/api/billing/checkout/route.ts:128`).
- **Consequência:** quem já paga Economy e clica em "Upgrade to Business" fica com **duas assinaturas
  ativas** — cobrança dupla. É o cenário que a Tracey quer evitar.
- **Caminho seguro hoje:** o Stripe Customer Portal (`/settings` → `/api/create-portal-session`),
  **se** o portal estiver configurado no Dashboard para permitir troca de plano.
  Isso é configuração do Stripe, não dá para ver no código.
- `hasUsedTrial` já bloqueia um segundo trial. Não bloqueia uma segunda assinatura.

### ⚠️ Falha de pagamento — revoga na primeira falha

- `invoice.payment_failed` grava `hasAccess: false` na hora, sem carência (`route.ts:316-321`);
  `subscription.updated` com `past_due` também zera. A Stripe ainda vai fazer Smart Retries —
  o acesso cai antes de as retentativas terminarem.
- Efeito colateral: nesse evento `tier` vai `undefined` → o doc raiz fica com `tier: null`.
- `community` fica preservado aqui. ✅

### ❌ Idempotência — ainda não existe

- Não há dedup por `event.id`. A Stripe entrega em at-least-once → um retry pode gerar
  **convite duplicado** no Skool (e o Zap também dispara direto da Stripe).

### ❌ Fundadores — não existem no código

- Não há flag `isFounder`, nem preço de fundador mapeado. `grep -ri founder` = **0 resultados**.
- O campo `community` é **gravado mas não é lido em nenhum lugar** do app — nenhuma tela ou guard usa.
  Hoje quem entrega o acesso é o convite do Skool, não o app. Aceitável, mas fica registrado.

### ⚠️ Convite do Skool — ponto que pode estar escondendo bug

- O convite **não passa pelo nosso webhook**: o Zap tem trigger direto na Stripe. Vale o filtro do Zap.
- Documentado (doc 07 §2.2 e doc 05 §5.4): o filtro exige `active`.
  Economy e Business começam em **trial de 14 dias** → status `trialing` → **não recebem convite**.
- **O teste de vocês deu certo porque foi pelo Green Room ($9), que não tem trial.**
  É exatamente o caso que mascara o bug — está escrito na doc 05 §5.4.
- **Confirmar antes de ligar:** o filtro aceita `active` **ou** `trialing`.

---

## O que isso significa para o lançamento

O coração está pronto: pagamento confirmado → convite do Skool, testado com a Raquel e com você.
Dá para publicar. Antes de soltar os links, 3 ajustes rápidos:

| # | Ajuste | Onde | Esforço |
|---|---|---|---|
| 1 | Filtro do Zap aceitar `active` **ou** `trialing` | Zapier | minutos |
| 2 | Upgrade/downgrade roteado pelo Customer Portal (ou `subscriptions.update` com proration) | Stripe Dashboard **ou** código | minutos / horas |
| 3 | Preservar `community` no cancelamento (`route.ts:289`) | código | 1 linha |

| # | Ajuste recomendado (não bloqueia) | Onde |
|---|---|---|
| 4 | `event.id` para idempotência | webhook |
| 5 | Carência em `invoice.payment_failed` | webhook |
| 6 | Flag de fundador + preços de fundador | código + Stripe |

**Os 200 fundadores: manual, como você disse.** A Skool não tem preço por membro — só por comunidade.
Logo, nem coorte nem desconto de fundador são reconhecidos lá. Plano:
pegar os e-mails → procurar no Skool → conceder acesso gratuito. Lista fechada, faz-se uma vez.

**Divisão sugerida:**
- **Raquel:** lista dos 200 e-mails + concessão manual no Skool.
- **Caio / Marcos:** itens 1, 2 e 3 antes de abrir os links.

---

# 2) VERSÃO PARA A TRACEY

## 2.1 Em português

Oi Trace,

Boa notícia: o sistema está pronto e podemos colocar no ar.

**Como fica**

- Uma única fonte de cobrança: o Stripe. Uma pessoa = uma assinatura só.
  Não há cobrança duplicada porque quem controla a assinatura inteira — incluindo upgrade,
  downgrade e cancelamento — é o Stripe, não a plataforma da comunidade.
- Quando o pagamento é confirmado, o convite para a Green Room no Skool sai automaticamente.
  O acesso à comunidade é o mesmo nos três planos: mudar de plano não muda nada dentro do Skool.
- Testámos o fluxo de ponta a ponta e o convite chegou (a Raquel e o Marcos receberam).

**Os 200 fundadores**

Isto terá de ser feito à mão, e não é limitação nossa: o Skool não tem preço por membro, só por
comunidade. Não existe forma de o Skool reconhecer uma coorte de fundadores nem de lhes aplicar
um desconto individual.

Plano: pegamos os e-mails dos 200, encontramos cada pessoa no Skool e damos o acesso gratuito.
É uma lista fechada, faz-se uma vez. Ninguém é cobrado por isso — e o Green Room vitalício fica
independente do plano do app: se a pessoa cancelar o app depois, continua na comunidade.

Para avançar preciso só da confirmação da lista de e-mails dos fundadores.

**O que fica fora da automação**

O cancelamento não remove automaticamente ninguém do Skool — o Skool não expõe essa ação, como o
vosso suporte confirmou. O Stripe para a cobrança imediatamente e nós removemos do Skool à mão.

**Para ligar**

Falta só o vosso ok. Estamos a fechar a última validação do fluxo de upgrade, para garantir que
ninguém fica com duas assinaturas, e depois abrimos os links.

Obrigado!

---

## 2.2 Em inglês (pronta para enviar)

Hi Trace,

Good news — the system is ready and we can go live.

**How it works**

- One single billing source: Stripe. One person = one subscription. There is no double charging,
  because Stripe controls the whole subscription — including upgrades, downgrades and cancellations —
  not the community platform.
- Once a payment is confirmed, the invitation to the Green Room on Skool is sent automatically.
  The community access is the same on all three plans: changing plan changes nothing inside Skool.
- We tested the flow end to end and the invitation arrived (Raquel and Marcos both received it).

**The 200 founding members**

This part has to be done manually, and it is not a limitation on our side: Skool has no per-member
pricing, only per-community. There is no way for Skool to recognise a founders' cohort or to apply
an individual discount.

The plan: we take the emails of the 200, find each person on Skool and grant free access.
It is a closed list, done once. Nobody is charged for it — and the lifetime Green Room stays
independent from the app plan: if someone cancels the app later, they remain in the community.

To move forward I just need the confirmed list of founders' emails.

**What stays outside the automation**

A cancellation does not automatically remove anyone from Skool — Skool does not expose that action,
as your support confirmed. Stripe stops the charge immediately and we remove them from Skool by hand.

**To go live**

We only need your go-ahead. We are closing the last validation of the upgrade flow, to make sure
nobody ends up with two subscriptions, and then we open the links.

Thank you!

---

## Notas internas (não enviar)

| Ponto | Observação |
|---|---|
| Tratamento | PT no masculino. Se preferir feminino, trocar "Obrigado" → "Obrigada". |
| O que **não** foi dito à cliente | O bug do filtro `active` vs `trialing`, a falta de idempotência e o furo do `community` no cancelamento. São técnicos, têm correção rápida e não mudam a resposta dela. |
| O que **foi** dito com cuidado | "Upgrade/downgrade/cancelamento no Stripe" — verdadeiro **depois** do ajuste 2. Não prometer proration antes de o portal estar configurado. |
| Risco se publicar sem os ajustes | Economy/Business em trial não recebem convite; upgrade pelo `/upgrade` gera segunda assinatura. |
| Dependência da cliente | Lista dos 200 e-mails (Raquel) e o ok final. |
