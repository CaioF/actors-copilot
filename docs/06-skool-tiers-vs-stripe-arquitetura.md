# 06 — Skool nativo vs Stripe: decisão de arquitetura

> Resposta à pergunta da Tracey (14/10/2026): usar os **tiers nativos do Skool** como base, ou manter o **Stripe como sistema central**?

---

## Resposta curta

**O Stripe tem de continuar sendo o sistema central. Os tiers nativos do Skool não servem para este caso.**

O Skool é excelente para **hospedar a comunidade** e para **receber membros por convite**. Ele **não** consegue cumprir três requisitos que a própria Tracey listou: preço diferenciado para os founding members, seletor de moeda com valores diferentes, e cobrança proporcional em upgrade/downgrade.

---

## 1. Por que os tiers nativos do Skool não resolvem

### 1.1 🔴 Founding members — impossível no Skool

A Tracey pediu:
- Green Room **grátis para sempre** para os 200 primeiros
- Economy por **$10** em vez de $19
- Business por **$20** em vez de $29

**O Skool não tem preço por membro.** Os tiers são preços fixos definidos pelo admin e aplicados a **todos**. Não existe:
- preço individual/grandfathered por conta;
- cupom ou código de desconto aplicável ao tier;
- reconhecimento automático de uma "coorte" de fundadores.

Ou seja: mesmo que os 200 fundadores entrassem pelo Skool, **o Skool não saberia cobrar $10 deles**. E o desconto que ela prometeu é sobre o **app** (Economy/Business), não sobre a comunidade.

**Conclusão:** esse requisito só existe no Stripe.

### 1.2 Seletor de moeda com valores diferentes — impossível no Skool

A Tracey quer:

| Plano | USD | GBP | EUR |
|---|---:|---:|---:|
| Green Room | $9 | £7 | €8 |
| Economy | $19 | £14 | €17 |
| Business | $29 | £22 | €26 |

O **Skool cobra em USD**. Não há seletor de moeda nem preço localizado no checkout do Skool — a própria Tracey levantou essa dúvida ("but Skool may only offer $?").

O Stripe faz isso nativamente, e o app **já está preparado** (`RequestedCurrency = 'usd' | 'eur' | 'gbp'` em `lib/plan-selection.ts`, vindo do PR #79).

### 1.3 Upgrade/downgrade com cobrança proporcional — só no Stripe

Ela pediu explicitamente: quem sobe de plano **não pode pagar duas assinaturas**, e a cobrança deve respeitar o fim do período pago.

- **Stripe:** faz isso nativamente (proration, `cancel_at_period_end`, troca de price).
- **Skool:** cada tier é uma assinatura isolada. Upgrades viram cancelar + assinar de novo.

Dois sistemas de cobrança em paralelo é exatamente o cenário que ela quer evitar: "sem conflicting subscriptions, duplicate payments".

### 1.4 Outros pontos

| Requisito | Skool nativo | Stripe (código) |
|---|---|---|
| Trial de **14 dias do app** | ❌ O trial do Skool é de **7 dias** e é do Skool | ✅ Já implementado |
| Green Room vitalício **independente** do plano do app | ❌ Não expressa "grátis aqui + pago ali" | ✅ Já modelado como `community` separado de `tier` |
| Fonte de verdade do que foi pago | ❌ Sem API oficial | ✅ Webhook do Stripe |
| Taxas da plataforma | ❌ Skool retém parte do valor pago pelo Skool | ✅ Pagamento direto, sem intermediário |
| Automação confiável | ⚠️ Sem API oficial; só Zapier (exige **Skool Pro**) | ✅ API própria, idempotente |

> ⚠️ **Achado novo:** a documentação do próprio Skool diz que a integração com Zapier "is only available on the **Pro plan**, and not on the Hobby plan". Ou seja, há um **custo no lado do Skool** também — não só o plano Pro do Zapier. Vale confirmar em qual plano a comunidade está.

---

## 2. Arquitetura recomendada

```text
        ┌─────────────────────────────────────────────┐
        │  STRIPE — fonte única de verdade            │
        │  Green Room  $9 / £7 / €8  (mensal e anual) │
        │  Economy     $19 / £14 / €17                │
        │  Business    $29 / £22 / €26                │
        │  + preços de fundador ($10 / $20)           │
        └───────────────────┬─────────────────────────┘
                            │ webhook
                            ▼
        ┌─────────────────────────────────────────────┐
        │  NOSSO APP (Next.js + Firestore)            │
        │  • appTier   → economy | business | none    │
        │  • community → green_room (permanente p/    │
        │                fundadores)                  │
        │  • idempotência, proration, trial           │
        └───────────────────┬─────────────────────────┘
                            │ convite (Make/Zapier)
                            ▼
        ┌─────────────────────────────────────────────┐
        │  SKOOL — só hospeda a comunidade            │
        │  • 1 (uma) Green Room para todos            │
        │  • membros entram por CONVITE               │
        │  • não vende assinatura                     │
        └─────────────────────────────────────────────┘
```

**Papel de cada um:**

| Sistema | Responsabilidade |
|---|---|
| **Stripe** | Cobrar, aplicar desconto de fundador, converter moeda, prorratear upgrade/downgrade, trial |
| **App (Firestore)** | Guardar o que cada pessoa tem direito: tier do app + acesso à comunidade |
| **Skool** | Hospedar o conteúdo e receber o membro convidado |

### ⚠️ Consequência que precisa ficar clara para a Tracey

**O Skool não pode vender as mesmas assinaturas em paralelo.** Se o grupo estiver com tiers pagos ativos **e** o site vender pelo Stripe, teremos exatamente o problema que ela quer evitar: duas cobranças, dois cadastros, dois lugares para cancelar.

Como os requisitos de **fundador** e de **moeda** só existem no Stripe, quem vende tem de ser o **Stripe**. O Skool fica como destino, não como loja.

---

## 3. Founding members — como funciona na prática

### 3.1 O que eles mantêm

| Direito | Onde vive | Sobrevive ao cancelamento do app? |
|---|---|---|
| Green Room **grátis para sempre** | Firestore, campo `community: 'green_room'` **permanente** | ✅ **Sim** — é um direito separado do `tier` |
| Desconto no app: Economy **$10**, Business **$20** | Stripe (cupom ou preço dedicado) | ❌ Não — vale enquanto a assinatura do app estiver ativa |

O modelo de dados **já suporta isso**: em `lib/billing.ts`, `community` é independente de `appTier`. Cancelar Economy/Business zera o `appTier` e **preserva** o `community`.

### 3.2 Como aplicar o desconto no Stripe

Duas opções:

**Opção 1 — Preços dedicados de fundador** (recomendada)
```
Economy Founders  $10/mês   · anual $100
Business Founders $20/mês   · anual $200
```
Preços separados, usados só por quem é fundador. Vantagens: histórico limpo, relatórios separados, impossível aplicar por engano.

**Opção 2 — Cupom de $9 off para sempre**
Um cupom `forever` de $9 aplicado à assinatura. Vantagem: não cria preços novos. Desvantagem: cupom pode vazar se virar código promocional público.

### 3.3 ❓ Ponto que precisa ser confirmado com a Tracey

O desconto que ela descreveu é "equivalente ao Green Room". Mas o Green Room custa **valores diferentes por moeda**:

| Moeda | Green Room | Economy normal | Economy fundador | Business normal | Business fundador |
|---|---:|---:|---:|---:|---:|
| USD | $9 | $19 | **$10** | $29 | **$20** |
| GBP | £7 | £14 | **£7** | £22 | **£15** |
| EUR | €8 | €17 | **€9** | €26 | **€18** |

Ela só deu os números em dólar. **É preciso confirmar se o desconto em GBP/EUR segue a tabela acima** (descontando o valor local do Green Room) ou se ela quer outro arredondamento.

### 3.4 A pergunta central dela, respondida

> "Can this [Skool] recognise our founding members and automatically offer them the discounted Economy and Business prices?"

**Não.** O Skool não reconhece coortes nem aplica preço individual.

**Portanto:** os fundadores **não devem fazer upgrade dentro do Skool**. Eles fazem upgrade **no site/app**, onde o Stripe identifica que são fundadores e aplica o preço correto. Dentro do Skool eles simplesmente já são membros — e continuam sendo.

---

## 4. Ajustes necessários no Stripe

### 4.1 Green Room — corrigir valores

Os preços atuais foram criados com o valor do dólar repetido. A tabela da Tracey tem valores locais diferentes.

| Ciclo | Moeda | Atual | **Correto** |
|---|---|---:|---:|
| Mensal | USD | $9 | $9 ✅ |
| Mensal | GBP | £9 | **£7** |
| Mensal | EUR | €9 | **€8** |
| Anual | USD | $90 | $90 ✅ |
| Anual | GBP | £90 | **£70** |
| Anual | EUR | €90 | **€80** |

### 4.2 Economy e Business — faltam moedas

Hoje esses preços têm `currency_options` **apenas com EUR**. Não existe USD nem GBP.

| Plano | Mensal | Anual |
|---|---|---|
| Economy | $19 · £14 · €17 | $190 · £140 · €170 |
| Business | $29 · £22 · €26 | $290 · £220 · €260 |

### 4.3 Alinhar a estratégia de moeda (pendência do PR #79)

Hoje convivem **duas abordagens**:

| | PR #79 (`main`) | Green Room (nossa branch) |
|---|---|---|
| Como | `currency_options` no **mesmo Price** | **3 Prices separados** |

Para o seletor de moeda do app funcionar igual nos três planos, o Green Room deve migrar para `currency_options`, como Economy e Business. Isso também resolve o conflito de merge em `app/api/billing/checkout/route.ts`.

---

## 5. Resumo das decisões

| Pergunta da Tracey | Resposta |
|---|---|
| Usar os tiers nativos do Skool como base? | ❌ **Não.** Não suportam preço de fundador, seletor de moeda nem proration. |
| Stripe continua central? | ✅ **Sim.** O Skool hospeda a comunidade e recebe convites. |
| Os fundadores são reconhecidos automaticamente no Skool? | ❌ Não. O desconto é aplicado no **Stripe**, no upgrade feito pelo site/app. |
| Green Room vitalício sobrevive ao cancelamento do app? | ✅ Sim — `community` é independente de `appTier` no nosso modelo. |
| Upgrade dentro do Skool? | ❌ Evitar. Upgrade pelo site/app, para não duplicar cobrança. |
| Uma única Green Room? | ✅ Sim, confirmado pela Tracey. Um convite só, sem níveis. |
| Uma assinatura só por pessoa? | ✅ Sim — Stripe como única fonte de cobrança. |
| O que fazer com quem já é membro do Skool? | Não reconvidar. Checar antes de convidar (evita duplicidade). |
| Cancelamento remove do Skool? | Definir política — o Skool **não** tem remoção automática confiável. |
