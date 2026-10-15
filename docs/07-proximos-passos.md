# 07 — Próximos passos

> Roadmap para concluir a integração Green Room × Stripe × Skool.
> Atualizado em 14/10/2026, após a resposta da Tracey.

**Legenda de responsável:** 🟢 eu consigo fazer agora · 🟡 depende da Tracey · 🔵 depende do outro dev

---

## Bloco 0 — Decisões que travam o resto

Sem estas respostas, o trabalho dos blocos seguintes fica em risco de retrabalho.

| # | Decisão | Quem | Por que trava |
|---|---|---|---|
| 0.1 | **O Skool vende assinatura ou não?** | 🟡 Tracey | Se o Skool vender em paralelo ao Stripe, teremos cobrança duplicada. Como fundador e moeda só existem no Stripe, o recomendado é o **Stripe vender** e o Skool só receber convite. |
| 0.2 | **Desconto de fundador em GBP e EUR** | 🟡 Tracey | Ela só deu os números em dólar. Falta confirmar £7/£15 e €9/€18 (Economy/Business fundador). |
| 0.3 | **Em qual plano do Skool a comunidade está?** (Hobby ou Pro) | 🟡 Tracey | A doc do Skool diz que a integração Zapier exige **Pro**. Se for Hobby, o caminho muda para Make.com. |
| 0.4 | **Política de cancelamento e inadimplência** | 🟡 Tracey | Define se remove do Skool, quando, e se há carência. O Skool não tem remoção automática confiável. |
| 0.5 | **Estratégia de moeda: `currency_options` ou Prices separados?** | 🔵 outro dev | O PR #79 usa `currency_options`; nós hoje temos 3 Prices separados no Green Room. Precisa ser uma coisa só. |

---

## Bloco 1 — Completar e corrigir a matriz de preços no Stripe 🟢

A Tracey já deu os números. **Isto eu consigo fazer agora.**

### 1.1 Corrigir o Green Room (valores locais)
| Ciclo | Moeda | Hoje | Corrigir para |
|---|---|---:|---:|
| Mensal | GBP | £9 | **£7** |
| Mensal | EUR | €9 | **€8** |
| Anual | GBP | £90 | **£70** |
| Anual | EUR | €90 | **€80** |

### 1.2 Adicionar as moedas que faltam em Economy e Business
Hoje eles têm `currency_options` **só com EUR**. Faltam USD e GBP:

| Plano | USD | GBP | EUR |
|---|---|---|---|
| Economy mensal | $19 | £14 | €17 ✅ |
| Economy anual | $190 | £140 | €170 ✅ |
| Business mensal | $29 | £22 | €26 ✅ |
| Business anual | $290 | £220 | €260 ✅ |

### 1.3 Criar os preços de fundador (bloqueado por 0.2)
| Plano | Mensal | Anual |
|---|---:|---:|
| Economy Founders | $10 | $100 |
| Business Founders | $20 | $200 |

### 1.4 Consequência
Depois disso, o seletor de moeda do app funciona nos três planos, e o checkout de Economy/Business passa a aceitar USD e GBP — hoje ele **só** aceita EUR, porque é o único `currency_option` existente.

---

## Bloco 2 — Automatizar o convite do Skool

### 2.1 Escolher o motor (bloqueado por 0.3)
| Opção | Custo | Situação |
|---|---|---|
| **Zapier Pro** | ~US$20–30/mês | Zap já existe, mas não publica no free (fluxo multi-etapa) |
| **Make.com** | ✅ Free plan | Tem o módulo `Invite a New Member`; exige começar por webhook |

Recomendado: **Make.com**, chamado pelo nosso próprio webhook. A decisão fica no código, não num filtro visual.

### 2.2 🔴 Corrigir o filtro que quebra trials — **P0**
Hoje o filtro exige status `active`. Economy e Business começam em **trial de 14 dias** → status `trialing` → **não recebem convite**. O Green Room (sem trial) passa, então o bug fica escondido ao testar pelo link de $9.

Correção: aceitar `active` **ou** `trialing`; nunca convidar em `past_due`, `unpaid`, `incomplete`, `canceled`.

### 2.3 Idempotência no webhook do Stripe
O webhook atual **não** deduplica por `event.id`. Sem isso, um retry da Stripe pode gerar **convites duplicados por e-mail**. Precisa ser resolvido **antes** de ligar o convite automático.

### 2.4 Não reconvidar quem já é membro
Se a pessoa já está no Skool, o convite não deve ser reenviado. Verificar antes de convidar.

---

## Bloco 3 — Fechar o código

### 3.1 Resolver o conflito com o PR #79 🔵
`app/api/billing/checkout/route.ts` conflita: nós adicionamos `product`, o PR adicionou `currency`. Dá para manter os dois — mas depende da decisão 0.5.

### 3.2 Decidir o caminho de venda dentro do app
Hoje o Green Room é vendido **só por Payment Link** (Caminho A). O backend já suporta `product: 'green_room'`, mas **não existe botão na tela `/upgrade`**.
- **Caminho A** (Payment Link): pronto, sem deploy.
- **Caminho B** (dentro do app): falta card na UI + `STRIPE_GREEN_ROOM_PRICE_ID` no deploy.

### 3.3 Adicionar a lógica de fundador
Marcar a conta como fundadora e mapear para o preço de fundador. O campo `community` já é independente de `appTier`, então o **Green Room vitalício sobrevive ao cancelamento do app** sem mudança estrutural.

---

## Bloco 4 — Experiência pós-pagamento (a Tracey pediu "C — os dois")

| # | Item | Situação |
|---|---|---|
| 4.1 | Página de agradecimento profissional | ❌ Não existe. O app hoje só redireciona para `/dashboard` |
| 4.2 | E-mail de confirmação com os detalhes da assinatura | ❌ Não existe. Há Resend no projeto, sem uso para isso |
| 4.3 | Convite do Skool se ainda não for membro | ⛔ Bloco 2 |
| 4.4 | Acesso imediato às ferramentas do app | ✅ Já funciona via tier no Firestore |
| 4.5 | Mensagem nos Payment Links | ❌ Pendente — só faz sentido quando 4.3 funcionar |

---

## Bloco 5 — Upgrades, downgrades e cancelamentos

| # | Item | Situação |
|---|---|---|
| 5.1 | Upgrade sem pagar duas vezes (proration) | ✅ Stripe faz nativamente; falta garantir na troca de price |
| 5.2 | Upgrade não gera novo trial | ⚠️ Verificar: o checkout atual dá trial a **qualquer** primeiro checkout |
| 5.3 | Downgrade respeitando o período pago | ⚠️ Definir com 0.4 |
| 5.4 | Cancelamento ajusta acesso ao app | ⚠️ O `community` de fundador deve ser **preservado** |
| 5.5 | Remoção do Skool no cancelamento | ⚠️ Definir com 0.4; o Skool não tem remoção confiável |

---

## Bloco 6 — Testar e publicar

1. **Testar em Test Mode** — criar os preços equivalentes no modo de teste e rodar a compra com cartão `4242 4242 4242 4242`.
2. **Testar o convite** com um e-mail que **ainda não seja membro** do Skool (senão o passo não faz nada e parece falhar).
3. **Testar o trial** — comprar Economy e confirmar que o convite chega mesmo com status `trialing`.
4. **Testar upgrade** — Green Room → Economy, e confirmar que **não** há cobrança dupla.
5. **Testar fundador** — aplicar o preço de fundador e cancelar, confirmando que o Green Room permanece.
6. **Só então** divulgar os links.

---

## Sequência sugerida

```text
1. Tracey responde 0.1 a 0.4          (destrava tudo)
   ↓
2. Eu corrijo a matriz de preços      (Bloco 1 — já dá para começar)
   ↓
3. Eu fecho o código                  (Bloco 3: conflito, fundador, UI)
   ↓
4. Eu ligo o convite com idempotência (Bloco 2.2, 2.3, 2.4)
   ↓
5. Página de obrigado + e-mail        (Bloco 4)
   ↓
6. Upgrades e cancelamentos           (Bloco 5)
   ↓
7. Teste ponta a ponta em Test Mode   (Bloco 6)
   ↓
8. Lançamento
```

---

## O que eu posso fazer agora, sem esperar ninguém

1. ✅ Corrigir os valores GBP/EUR do Green Room (£7/€8 e £70/€80)
2. ✅ Adicionar USD e GBP nos preços de Economy e Business
3. ✅ Criar os preços de fundador em USD ($10/$20 + anuais)
4. ✅ Escrever a resposta para a Tracey com as perguntas 0.1 a 0.4
5. ✅ Documentar o plano de testes

O item 1.3 (fundador em GBP/EUR) e todo o Bloco 2 dependem de resposta.
