# Mensagem para a cliente — verificação final do Green Room

Rascunho de mensagem para enviar à Trace. Linguagem simples, sem termos técnicos.
Duas versões: **inglês** (para enviar) e **português** (para você revisar).

---

## Versão em inglês (para enviar)

Hi Trace,

We're almost there! I just need to confirm a few things with you so I can finish the setup.

**1. The prices**

This is what is already set up. Can you confirm these are the values you want?

| | Monthly | Annual |
|---|---|---|
| US$ | $9 | $90 |
| £ | £9 | £90 |
| € | €9 | €90 |

The annual price is currently calculated as 10× the monthly price (so 2 months free). That is the same logic already used for Economy and Business.

If you prefer a different annual amount, just tell me the number and I will adjust it.

**2. Who receives the Green Room invitation?**

Today, when someone subscribes to **Economy ($19)** or **Business ($29)**, they automatically receive the invitation to the Green Room on Skool.

❓ **My question:** should the **Green Room plan ($9)** also send the Skool invitation automatically?

I believe the answer is yes, but I want to confirm before we go live.

**3. Where does each plan go on Skool?**

This is where I am getting a little lost, and I would love your help:

- Is there **one single Green Room** for everyone, or **different groups or levels**?
- Do Economy and Business both go to the **same place**?
- Does the **annual** plan give exactly the same access as the **monthly** plan?
- Is there anything that a $9 member gets **less** of inside Skool compared to Economy or Business?

**4. What should the person see right after paying?**

In simple terms — what is the ideal experience for the customer once the payment is confirmed? For example:

- **(a)** They receive an email inviting them to join the Green Room on Skool
- **(b)** They see a thank-you page with clear instructions
- **(c)** Both
- **(d)** Something else

Tell me what you have in mind and I will build it exactly like that.

As soon as I have these answers, everything is ready to go live.

Thank you!

---

## Versão em português (para revisão)

Oi Trace,

Estamos quase lá! Só preciso confirmar algumas coisas com você para terminar a configuração.

**1. Os valores**

Isto é o que já está configurado. Você pode confirmar se são esses os valores que você quer?

| | Mensal | Anual |
|---|---|---|
| US$ | $9 | $90 |
| £ | £9 | £90 |
| € | €9 | €90 |

O valor anual hoje está calculado como 10× o mensal (ou seja, 2 meses grátis). É a mesma lógica que já é usada no Economy e no Business.

Se você preferir outro valor anual, é só me passar o número que eu ajusto.

**2. Quem recebe o convite do Green Room?**

Hoje, quando alguém assina o **Economy ($19)** ou o **Business ($29)**, recebe automaticamente o convite para o Green Room no Skool.

❓ **Minha pergunta:** o plano **Green Room ($9)** também deve enviar o convite do Skool automaticamente?

Eu acredito que sim, mas quero confirmar antes de colocar no ar.

**3. Para onde cada plano vai no Skool?**

É aqui que eu estou me perdendo um pouco, e eu adoraria a sua ajuda:

- Existe **um único Green Room** para todo mundo, ou **grupos/níveis diferentes**?
- Economy e Business vão para o **mesmo lugar**?
- O plano **anual** dá exatamente o mesmo acesso que o **mensal**?
- Existe algo que um membro de $9 recebe **a menos** dentro do Skool em relação ao Economy ou Business?

**4. O que a pessoa deve ver logo depois de pagar?**

Em termos simples — qual é a experiência ideal para o cliente assim que o pagamento é confirmado? Por exemplo:

- **(a)** Ela recebe um e-mail convidando para entrar no Green Room no Skool
- **(b)** Ela vê uma página de agradecimento com instruções claras
- **(c)** As duas coisas
- **(d)** Outra coisa

Me conta como você imagina e eu construo exatamente assim.

Assim que eu tiver essas respostas, está tudo pronto para entrar no ar.

Obrigado!

---

## Notas internas (não enviar)

| Ponto | Observação |
|---|---|
| Nome e tratamento | Confirme se é "Trace" mesmo. Em português ficou no masculino ("Obrigado") — se for mulher, troque para "Obrigada". |
| Valores anuais | Os valores de $90 / £90 / €90 foram **inferidos por mim** (10× o mensal), com base em Economy €19→€190 e Business €29→€290. A cliente precisa confirmar. Se ela quiser 20% off em vez de 2 meses grátis, o número muda. |
| Pergunta do $9 | O ponto central: hoje o fluxo convida apenas compradores de $19 e $29. Precisamos saber se o plano de $9 também convida e se ele deve **parar** o fluxo ou continuar. |
| Mapa do Skool | A resposta dela define se existe **um grupo só** ou **grupos/tiers diferentes**. Sem isso, não dá para saber se `Unlock Course for Member` deve ser usado. |
| 🚫 O que ficou FORA de propósito | Não mencionei o problema do filtro `active` vs `trialing`, nem a discussão Zapier Pro × Make.com, nem o conflito com o PR #79. É técnico demais para a cliente e não muda a resposta dela. |
| ⚠️ Risco técnico pendente | Independente da resposta dela: quem assina Economy/Business fica em **trial de 14 dias**, e o filtro atual exige `active` — ou seja, **não recebe convite durante o trial**. Precisa ser corrigido antes de publicar. |
