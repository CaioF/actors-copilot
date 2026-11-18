# Revisión de código — `actors-copilot`

**Fecha:** 2026-11-03
**Base:** `main` @ `dea3817` (Merge PR #95)
**Alcance:** repositorio completo
**Cambios de código en este PR:** ninguno. Este PR solo agrega este informe.

---

## 1. Método

Revisión estática con lectura directa del código en `main`, `git blame` por línea para
atribuir cada hallazgo a su autor real, `git show` sobre los commits relevantes, y
ejecución de la suite de tests y del typecheck para validar el estado base.

Cobertura: **las 29 rutas de API** bajo `app/api/**`, los módulos de sesión y
autorización (`lib/session.ts`, `lib/admin-dashboard/session.ts`, `proxy.ts`), el
subsistema de billing y Stripe (`lib/billing*.ts`, `app/api/billing/**`,
`app/api/webhooks/stripe/route.ts`), el pipeline de chat y DNA (`hooks/use-chat.ts`,
`lib/chat-types.ts`, `app/api/dna/**`, `app/api/coach/**`), las rutas de audiciones
(`app/api/auditions/**`, `components/auditions/**`) y el subsistema Reader/Actor
Copilot (`components/actor-copilot/**`, `lib/actor-copilot/**`,
`app/api/actor-copilot/**`).

**Base de comparación:** `main`. Los hallazgos se reportan contra el código vigente,
independientemente de quién lo escribió. La sección 6 desglosa la atribución.

---

## 2. Resumen ejecutivo

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| Crítico | 1 | CR-1 |
| Alto | 2 | AL-1, AL-2 |
| Medio | 9 | MD-1 … MD-9 |
| Bajo | 8 | BA-1 … BA-8 |

**Los tres hallazgos de mayor severidad se concentran en dos archivos:**
`app/api/billing/success/route.ts` (CR-1) y
`components/actor-copilot/actor-copilot-rehearsal.tsx` (AL-1, MD-1 … MD-4).

CR-1 es un takeover de cuenta completo y es el único hallazgo que
recomendamos atender antes de la próxima release.

---

## 3. Crítico

### CR-1 — `GET /api/billing/success` emite una sesión de plataforma completa a partir de un parámetro de URL, sin bindear al caller

**Ubicación**
- `app/api/billing/success/route.ts:21-116` (emisión de la sesión)
- `proxy.ts:27` y `proxy.ts:47-49` (exención explícita de la ruta de auth)
- `lib/billing-checkout.ts:138` y `lib/billing-checkout.ts:158` (`client_reference_id` y `success_url`)
- `lib/session.ts:65-76` (emisión del cookie `platform_session`)
- `proxy.ts:55-77` (`platform_session` como credencial autorizante)

**Trigger**

1. Stripe redirige al usuario a `${appUrl}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`
   (`lib/billing-checkout.ts:158`). El `session_id` queda en la URL.
2. `GET /api/billing/success?session_id=cs_xxx` **no requiere ninguna cookie**:
   `proxy.ts:47-49` deja pasar la ruta antes de cualquier chequeo de sesión.
3. El handler resuelve el `session_id` con la **secret key del servidor**
   (`route.ts:32`), toma el `uid` de `sessionDetails.client_reference_id`
   (`route.ts:36`) y **nunca lo compara con el usuario que está firmado actualmente**
   — no hay ningún `getPlatformSession()` ni comparación de uid en el archivo.
4. Con ese uid emite `platform_session`: un JWT HS256 de 7 días con `uid`, `email`,
   `tier`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`,
   `stripePriceId` y `currentPeriodEnd` (`route.ts:96-112`).
5. `proxy.ts:55-77` valida ese cookie como **la credencial de la app** y concede
   acceso por tier a partir de su contenido.

**Impacto**

Cualquiera que obtenga el `session_id` de un checkout obtiene una sesión
autenticada completa de esa persona durante 7 días — con su tier pagado — sin
Firebase Auth, sin contraseña y sin MFA. El `session_id` viaja en la URL, así que
se filtra por historial del navegador, `Referer` hacia terceros desde el dashboard,
capturas de pantalla, tickets de soporte y enlaces compartidos. Es un patrón
CWE-384 / CWE-598 (session fixation, bearer token en la URL).

Detalle adicional: la ruta no valida `payment_status === 'paid'` ni
`status === 'complete'`, así que **una sesión de checkout abierta y no pagada
también sirve** para emitir la sesión de plataforma.

**Fix**

Exigir que exista un `platform_session` previo y verificar que su `uid` sea igual a
`sessionDetails.client_reference_id` antes de emitir. Es viable porque el redirect de
Stripe es una navegación de primer nivel y `sameSite: 'lax'` sí envía la cookie en
ese caso. Alternativa más robusta: un token de estado de un solo uso, emitido en el
checkout y verificado aquí. En cualquiera de los dos casos, validar además
`payment_status` / `status` antes de emitir la sesión.

---

## 4. Alto

### AL-1 — "Grant Mic Access" deja el rehearsal hands-free muerto, sin ninguna señal de error

**Ubicación:** `components/actor-copilot/actor-copilot-rehearsal.tsx:1674-1686`
**Autor:** `copilot-swe-agent[bot]`, commit `c79c71d` (2026-09-28)

**Trigger**

El actor deniega el prompt de micrófono (o el navegador lo bloquea).
`getUserMedia` rechaza → `micPermissionError = true`; en paralelo, la Web Speech
API devuelve `not-allowed` → `fatal = true` en el efecto de recognition. El actor
hace clic en **"Grant Mic Access"** y acepta el permiso.

**Impacto**

El handler completo es:

```js
navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  micStreamRef.current = stream;
  setMicPermissionError(false);
}).catch(() => { /* permission still denied; keep the error visible */ });
```

Eso es todo. El banner desaparece, pero:

- **No** se llama `setIsMicReady(true)`. Su único punto de escritura es la línea
  228, dentro de `setupMicStream()`, que solo se invoca desde el efecto de
  micrófono con deps `[actorCharacter, status]` — y ninguno de los dos cambia al
  hacer clic.
- **No** se crea el `AudioContext` ni el `AnalyserNode`: el medidor de nivel queda
  muerto y el efecto de grabación de la toma del actor (línea 972, gateado por
  `isMicReady`) no arranca.
- **No** se reinicia la recognition: sus deps son
  `[actorCharacter, currentLineIndex, isActorTurn, isHandsFreeMode, isProcessing]`,
  y además `fatal` ya quedó en `true`, por lo que ni el `restartTimer` la revive.

Resultado: el usuario ve el error desaparecer y **no ocurre nada**. No arranca el
reconocimiento de voz, ni el medidor, ni la grabación de su toma. Es un callejón
sin salida silencioso: la única recuperación es recargar la página.

El commit que escribió este handler se titulaba explícitamente *"mic permission UX"*,
así que el hunk es de Copilot y su objetivo explícito no se cumple.

**Fix**

En el `.then`, setear `isMicReady` y forzar el reinicio del efecto de recognition
(un token de sesión en las deps, o llamar `setupMicStream()`).

---

### AL-2 — `tier` y `subscriptionStatus` se escriben fuera del webhook, contra el invariante de `AGENTS.md`

**Ubicación:** `lib/billing-checkout.ts:65-73`
**Autor:** humano (`cdfb993`)

**Trigger**

`resolveStripeCustomerId()` se llama con `knownCustomerId` falso — es decir, el
documento `users/{uid}/billing/current` no tiene `customerId` — y entonces escribe:

```js
await billingDocRef.set({
  customerId: customer.id,
  tier: 'free',
  status: 'canceled',
  updatedAt: new Date().toISOString(),
}, { merge: true });
```

El `set` es un `merge` sin condiciones: **sobrescribe `tier` y `status` siempre**.

**Impacto**

`AGENTS.md` establece que *"The webhook (`app/api/webhooks/stripe/route.ts`) is the
only writer of `hasAccess`, `tier` and `subscriptionStatus`"*. Esta es la única
escritura no-webhook de `billing/current` en el repo, y rompe el invariante en dos
direcciones:

- Un cliente de pago existente cuyo `billing/current` conserve un `tier` pero pierda
  el `customerId` (escritura parcial, doc borrado, migración) queda **degradado a
  `free` / `canceled`**. Como el webhook solo reacciona a eventos de Stripe, el
  derecho no se restaura hasta el próximo evento de factura: el usuario paga y no
  tiene acceso.
- El `merge` no preserva un `tier` existente que ya fuera válido.

**Fix**

En esa escritura, usar `fieldMask`/condición para setear **solo** `customerId` y
`updatedAt`, nunca `tier` ni `status`. Si hace falta inicializarlos, que sea el
webhook quien los escriba.

---

## 5. Medio

### MD-1 — Falsos positivos del matcher: substring crudo → 100 % de match

**Ubicación:** `lib/actor-copilot/script-parser.ts:160-162`
**Autor:** humano / v0 (`7c0559b`, `22202ad`)

**Trigger:** esperado `"I do."`, dicho `"I don't."` → normalizado `"i dont"`, que
**contiene** `"i do"` → `{isMatch: true, score: 1.0}` antes de cualquier lógica de
palabras. Lo mismo con `"No."` vs `"Not really."` o `"Know what I mean?"`.

**Impacto:** `getHandsFreeEndpointDelayMs` devuelve **900 ms** en vez de 3000 ms: el
turno se cierra con score perfecto ante una frase que no coincide, y el actor es
cortado. El test corre **antes** de la rama `isFinalResult`, así que también aplica
al matching interim del hands-free.

**Fix:** comparar por palabras completas (split del actual y búsqueda de una corrida
contigua igual a las palabras esperadas) en vez de `includes` sobre la cadena entera.

### MD-2 — Set de palabras ignora multiplicidad y orden → 100 % de match

**Ubicación:** `lib/actor-copilot/script-parser.ts:164-180` y `:216-233`
**Autor:** humano / v0

**Trigger:** esperado `"No, no, no, no!"`, dicho `"no"`. `actualWordSet` es un `Set`,
así que las 4 ocurrencias esperadas de `no` se cuentan como cubiertas por el único
`no` hablado → `wordScore = 1.0`.

**Impacto:** `getHandsFreeEndpointDelayMs` devuelve **900 ms** en vez de 4500 ms. El
turno del actor se cierra 900 ms después de su primera pausa, lo corta a mitad de
frase y la escena avanza sobre una línea que no se oyó. El **orden** de las
palabras también se ignora: `"the cat sat down"` vs `"sat down the cat"` → 1.0.

**Fix:** contar solapamiento multiconjunto (consumir una palabra hablada por cada
ocurrencia esperada) en vez de testear pertenencia a un `Set`.

### MD-3 — El watchdog de 20 s avanza la línea sin invalidar la captura en vuelo

**Ubicación:** `components/actor-copilot/actor-copilot-rehearsal.tsx:749-765` (con `:1087-1231`)
**Autor:** humano (`5c26a094`)

**Trigger:** la transcripción tarda más de `SPEECH_RECOVERY_TIMEOUT_MS` (20 s). El
watchdog llama `setCurrentLineIndex((prev) => prev + 1)` pero **no** cambia
`turnTokenRef`, así que el handler pendiente de `mediaRecorder.onstop` sigue viendo
`turnTokenRef.current === captureToken` y avanza el índice una segunda vez.

**Impacto:** el índice salta de a dos. La línea del partner nunca se dice, o el
turno siguiente del actor arranca mientras la IA todavía lee la línea anterior
(voces superpuestas). El estado además salta a `MATCHING_LINE` en medio de la
reproducción.

**Fix:** incrementar `turnTokenRef.current` dentro del watchdog antes de avanzar; el
token ya existe exactamente para esto.

### MD-4 — El botón de micrófono manual sigue habilitado durante la escucha hands-free

**Ubicación:** `components/actor-copilot/actor-copilot-rehearsal.tsx:1748-1777`, `:1056-1060`, `:768-816`
**Autor:** humano / v0

**Trigger:** hands-free activo (es el default) y el actor aprieta el botón de micrófono
durante su turno. `startRecording` setea `ACTOR_RECORDING` / `isRecording` pero nunca
detiene el recognizer, y las deps del efecto de recognition no cambian (because
`isProcessing` sigue en `false`). El recognizer sigue corriendo y su timer de
endpoint completa el turno (índice +1). Cuando el actor frena la grabación manual, la
ruta de transcripción avanza el índice otra vez.

**Impacto:** el rehearsal salta dos líneas, la línea siguiente del actor se superpone
con la de la IA, y se produce un segundo transcript/take duplicado del mismo momento.

**Fix:** deshabilitar el botón de micrófono mientras la escucha hands-free está
activa, o detener el recognizer en `startRecording`.

### MD-5 — El stream de micrófono de la grabación manual nunca se libera

**Ubicación:** `components/actor-copilot/actor-copilot-rehearsal.tsx:1069` (con `:422-437`)
**Autor:** humano / v0

**Trigger:** `startRecording` abre **su propio** stream de `getUserMedia` (no el de
`micStreamRef`) y solo frena sus tracks dentro de `mediaRecorder.onstop`. El cleanup
de unmount frena los tracks de `micStreamRef` y nunca toca `mediaRecorderRef`.

**Impacto:** salir de la página a mitad de una grabación deja el micrófono abierto
(indicador del navegador encendido) y el `MediaRecorder` acumulando chunks en
`audioChunksRef` indefinidamente.

**Fix:** en el cleanup de unmount, detener `mediaRecorderRef.current` y los tracks de su stream.

### MD-6 — Fallos de autenticación devuelven 500 en vez de 401

**Ubicación:** `app/api/actor-copilot/parse-script/route.ts:18` (con `:159-165`) y `app/api/actor-copilot/tts/route.ts:68` (con `:207-213`)
**Autor:** humano / v0

**Trigger:** un ID token vencido o inválido (el cliente usa `getIdToken()` sin
`forceRefresh`, y los tokens de más de 1 h se rechazan) → `auth.verifyIdToken` lanza
→ el `catch` genérico devuelve `500 { error: "Failed to parse script." }`.

**Impacto:** el actor ve "el servidor falló" en lugar de "volvé a iniciar sesión", y
los fallos de auth son indistinguibles de caídas de upstream en logs y métricas. La
convención del resto del proyecto es 401 (`app/api/profile/display-name/route.ts:18-22`,
`app/api/account/delete/route.ts:31-36`).

**Fix:** envolver `verifyIdToken` en su propio `try/catch` que devuelva `401 { error: "Unauthorized" }`.

### MD-7 — `parse-script` no valida el tipo ni el largo de `sidesText`

**Ubicación:** `app/api/actor-copilot/parse-script/route.ts:21-28`, `:45-47`, `:112`
**Autor:** humano / v0

**Trigger:** `{"sidesText": 123}` → `sidesText.trim()` lanza → 500 "Failed to parse
script." (debería ser 400). Un body JSON malformado → el mismo 500. No hay cota
superior, y `sidesText` se embebe **verbatim** en el prompt de Gemini (`:112`).

**Impacto:** 500s confusos para input malformado, y un script de tamaño arbitrario
se manda al modelo (riesgo de costo / desbord de contexto).

**Fix:** validar `sidesText` como string y rechazar bodies por encima de un máximo
con 400.

### MD-8 — El checkout cae al plan `business` cuando no viene `tier`

**Ubicación:** `app/api/billing/checkout/route.ts:51`
**Autor:** humano (`1361538` / `cdfb993`)

**Trigger:** `const selectedTier: SubscriptionTier = (tier && tier !== 'trial') ? tier : 'business';`
Un body `{}` — o un `tier: 'trial'` — resuelve al plan **más caro**, y la validación
de la línea 54 solo comprueba que sea `economy` o `business`.

**Impacto:** un cliente que olvide mandar el tier (o un POST vacío) crea una sesión
de Checkout de Stripe con el Price de Business. No hay cobro sin que el usuario
complete el pago, pero combinado con `isExplicitTrialReq` (que considera `tier ===
'trial'`), un body con `tier: 'trial'` abre un trial de 14 días de **Business**.

**Fix:** devolver 400 cuando `tier` no viene, en vez de asumir el plan más caro.

### MD-9 — El resultado del match se descarta en la ruta manual

**Ubicación:** `components/actor-copilot/actor-copilot-rehearsal.tsx:1189-1191` (avance en `:1200`); default del helper en `lib/actor-copilot/script-parser.ts:146`
**Autor:** el descarte es humano (`2c147043`); **el cambio del default es de Copilot** (`c79c71d`)

**Trigger:** en cualquier grabación manual se llama
`matchActorLine(recordedLine.dialogue, transcribedText);` y se descarta el valor
devuelto; el índice avanza igual.

**Impacto:** el actor que dice algo completamente distinto ve exactamente el mismo
flujo que una entrega correcta (no hay aviso de "la línea no coincidió"), y los
falsos positivos de MD-1 y MD-2 se aceptan en silencio. Como este es el único
consumidor de `matchActorLine` además del cálculo de delay, `score` e `isMatch`
nunca llegan a la UI.

Además, el cambio de default que Copilot hizo en `script-parser.ts:146`
(`isFinalResult: false → true`) **es inerte**: endurece el contrato de un helper
público cuyo único consumidor por defecto descarta el resultado. El cambio no
produce ningún efecto observable y sugiere que la ruta manual valida la línea
cuando no lo hace.

**Fix:** usar el `{ isMatch, score }` devuelto para mostrar un aviso de "no coincidió"
y/o contener el avance; o revertir el default mientras el resultado no se use.

---

## 6. Bajo

### BA-1 — El reintento de micrófono se traga el error sin telemetría
`components/actor-copilot/actor-copilot-rehearsal.tsx:1679-1681` — el `.catch(() => {})`
no loguea nada. Si el segundo `getUserMedia` también falla (permiso revocado, policy
del navegador, otra app en foreground), el actor solo ve el banner genérico y en
producción no hay forma de saber cuántos usuarios quedan trabados.
**Fix:** `logger.warn({ err, msg: 'mic retry failed' })`.

### BA-2 — "Record again" no detiene la reproducción de la IA
`components/actor-copilot/actor-copilot-rehearsal.tsx:404-412` — `handleRerecord`
llama `stopTakePlayback()` pero nunca `cancelPendingPlayback()`, así que `currentAudioRef`
sigue sonando mientras el actor graba. **Impacto:** el micrófono captura la voz de la
IA y la toma resulta inservible. **Fix:** llamar `cancelPendingPlayback()` antes de
cambiar de línea.

### BA-3 — `tts` no limita el largo de `text` y devuelve todo el audio como data URL base64
`app/api/actor-copilot/tts/route.ts:74-86`, `:137-152`; prefetch en
`components/actor-copilot/actor-copilot-rehearsal.tsx:490-497` — una línea de 10 s
en L16 PCM a 24 kHz son ~640 KB de base64 en una sola respuesta JSON; el prefetch
cachea hasta 6 de esos strings **y** un `HTMLAudioElement` por línea durante toda la
sesión. **Impacto:** varios MB retenidos en la pestaña y el payload base64 completo
transferido en cada turno de IA. **Fix:** capear el largo del texto y dejar de
cachear data URLs base64 (o servir el audio desde storage).

### BA-4 — El mute no silencia la línea que ya está sonando
`components/actor-copilot/actor-copilot-rehearsal.tsx:556-559` (vs `:573-578`), `:1430-1437` —
`playAiLine` consulta `isAudioMuted` solo al **inicio** de la línea. Además la rama
muteada retorna antes de `setStatus("AI_READING")`, así que el badge sigue mostrando
el turno anterior mientras la escena salta las líneas del partner. **Fix:** pausar
`currentAudioRef.current` cuando `isAudioMuted` pasa a `true`, y setear el estado en
la rama muteada.

### BA-5 — El micrófono queda abierto después de `FINISHED`
`components/actor-copilot/actor-copilot-rehearsal.tsx:208-212` — el cleanup del efecto
solo cancela el animation frame, nunca frena los tracks del stream. **Impacto:** el
indicador de micrófono del navegador queda encendido hasta cerrar la página.
**Fix:** frena los tracks de `micStreamRef` cuando el status pasa a `FINISHED`.

### BA-6 — `spokenLineIdsRef` no se limpia al reiniciar la escena
`components/actor-copilot/actor-copilot-rehearsal.tsx:185`, `:1020`, `:1262-1301` —
`handleResetRehearsal` limpia el store de tomas pero no el set de líneas ya dichas.
**Impacto:** el actor dice la línea X, reinicia la escena, permanece en silencio en X, y
el recorder hands-free igual guarda una toma (de silencio). El botón "Play my take"
reproduce silencio. **Fix:** limpiar `spokenLineIdsRef` en `handleResetRehearsal`.

### BA-7 — `response.json()` sin guard en una respuesta TTS fallida
`components/actor-copilot/actor-copilot-rehearsal.tsx:609-612` — si el TTS responde con
un body no-JSON (502 HTML del gateway), `await response.json()` lanza y el catch outer
reporta el error de parseo en vez de la causa real. **Fix:** `await response.json().catch(() => ({}))`,
como en los otros call sites (`:692`, `:1166`).

### BA-8 — `billing/recovery` devuelve 500 donde debería devolver 400/503
`app/api/billing/recovery/route.ts:86-87` — `getStripePriceIdForTier` lanza si el
Price ID anual no está configurado, y `getPriceCurrencies` falla si Stripe no responde;
ambos caen en el catch genérico → 500 "Could not open your checkout". **Impacto:** una
misconfiguración de env o una caída de Stripe se reportan como error del servidor.
**Fix:** guardas individuales → 400 para Price ID ausente, 503 para indisponibilidad
de Stripe.

---

## 7. Atribución: qué escribió GitHub Copilot y qué no

Esta revisión se浓郁ó específicamente sobre el código del agente
`copilot-swe-agent[bot]` (35 commits, todos ya fusionados en `main`; las ramas
`copilot/sub-pr-1` y `copilot/sub-pr-5` ya están contenidas en `main` y no hay PRs
abiertos de Copilot).

El `git blame` por línea da una imagen distinta de la que sugiere el nombre del
subsistema: **el subsistema Reader/Actor Copilot es casi enteramente código de v0
(Vercel) y de commits humanos** (Raquel Subero, Gabrielli-Fertig). El matcher, el
watchdog de recovery, `spokenLineIdsRef`, las rutas API y la máquina de estados de
permiso de micrófono son de v0 y de humanos. **Copilot no es dueño de CR-1, AL-2,
MD-1 … MD-8 ni de los bajos.**

Copilot es dueño de:

| Hunk | Estado |
|---|---|
| `actor-copilot-rehearsal.tsx:1674-1686` — handler de "Grant Mic Access" | **AL-1** (defectuoso) |
| `lib/actor-copilot/script-parser.ts:146` — default `isFinalResult` | **MD-9** (inerte) |
| `actor-copilot-rehearsal.tsx:242-248` — reuse del `AnalyserNode` | correcto (fix real de leak de nodos) |
| `actor-copilot-rehearsal.tsx:901,922` — guard de tomas obsoletas en reset | correcto (verificado: `sessionRef` no se invalida al avanzar de línea) |
| `app/api/billing/checkout/route.ts` — remoción de las escrituras pre-webhook de `hasUsedTrial` | correcto (cierra la ventana donde un checkout cancelado quemaba el trial; deja al webhook como único escritor) |
| `lib/billing.ts` — Price IDs anuales, `mapStripePriceToTier` con casos anuales | correcto (los anuales no degradan a `free`; un Price ID ausente sale como 400, no 500) |
| `app/api/webhooks/stripe/route.ts` — derivación del Price ID desde la suscripción, fallback de `current_period_end` al subscription item | correcto (verificado contra el SDK pineado: `Subscription` ya no expone `current_period_end`; `SubscriptionItem` sí) |
| `app/api/billing/checkout/route.ts` — guard de JSON malformado → 400 | correcto |
| `app/api/profile/autofill/route.ts` — allowlist de hostnames para la URL de IMDB + regex `/name/nm\d+` sobre el pathname | correcto (anti-SSRF) |
| `app/api/auditions/analyzeSides/route.ts` — chequeo de auth movido **antes** del parsing de archivos | correcto (evita DoS por parseo no autenticado; `analyzeBrief` quedó consistente: auth en `:129`, parsing en `:138`) |
| `app/api/auditions/**` — `logger.warn` con campos estructurados para alertas de seguridad | correcto |
| `lib/schemas/audition.ts`, `app/api/auditions/**` — validación de upload endurecida (quita `.doc`, alinea cliente/servidor, `ALLOWED_MIME_TYPES` a scope de módulo sin mutación) | correcto |
| `hooks/use-chat.ts` — dedup de temas del DNA contra `ARENA_THEMES` | correcto (las claves están en minúsculas y coinciden con el `toLowerCase()` del filtro) |
| `app/(interior)/acting-coach/page.tsx` — `safeProject`/`safeRole` opcionales | correcto (el consumidor cae a `"this project"`) |
| `app/api/coach/chat/route.test.ts` — mock de `@/lib/firebase-ai` | correcto (el módulo solo exporta `getAiApp` y la ruta solo importa eso; el mock no oculta nada) |
| `lib/question.ts` → `lib/questions.ts`, dedup de `components/ui/use-toast.ts` | correcto (no quedan imports del path viejo) |
| `ac19b7f` / `01160a5` — limpieza del `pnpm-workspace.yaml`, el `package-lock.json` de 17.980 líneas y el `package.json.bak` | correcto (hoy `main` solo tiene `pnpm-lock.yaml`) |

---

## 8. Verificado como correcto

- **Control de sesión admin** (`lib/admin-dashboard/session.ts`): JWT HS256 con
  `issuer` / `audience` / `subject` validados, cookie `httpOnly` + `sameSite: 'lax'`,
  comparación de credenciales con `timingSafeEqual`, expiración de 2 h.
- **Cobertura de auth de las rutas de API**: las 29 rutas bajo `app/api/**` fueron
  clasificadas. Las únicas sin auth explícita son las que legítimamente la necesitan:
  `admin/login` (autentica), `admin/logout` y `auth/logout` (destruyen cookies),
  `billing/currencies` (catálogo público), `billing/cancelled` (redirect), y
  `webhooks/stripe` (firma de Stripe). Las de datos —incluidas `admin/members`,
  `billing/recovery` y `billing/checkout`— sí la tienen.
- **Idempotencia de Stripe** (`lib/billing-checkout.ts`): cliente con
  `cust_${uid}`, sesión con `checkout_${uid}_${priceId}_${currency}_${attempt}_${originSlug}`.
  El invariante de `AGENTS.md` se cumple. Además se expiran las sesiones abiertas de
  otro origin para no reutilizarlas.
- **Inicialización de la sesión de plataforma** (`app/api/auth/callback/route.ts`):
  el callback de Firebase es el que setea `platform_session` con `hasAccess` derivado
  del estado de Firestore.
- **Guards de async stale en la ruta de reproducción de IA**: `playAiLine` toma un
  snapshot de `sessionRef` y aborta vía `isStale()` después de cada `await`;
  `cancelPendingPlayback` frena el audio, anula `onended`/`onerror` y limpia el timer
  de avance pendiente; `advanceAfter` protege con `prev === lineIndex`.
- **"Cada línea de la IA suena una vez por sesión"**: la clave
  `${sessionRef.current}:${currentLineIndex}` evita que un re-render, un cambio de
  voz o un toggle de mute reproduzcan la línea actual.
- **Token de turno**: `startRecording`, el reset y el unmount incrementan
  `turnTokenRef`, así que una transcripción tardía no puede tocar un rehearsal
  reiniciado o desmontado — salvo por la ruta del watchdog (**MD-3**).
- **Propiedad de las tomas**: se indexan por `line.id`, el recorder hands-free aborta
  si la sesión cambió, y `ActorTakeStore.put` reemplaza la toma anterior y revoca su
  blob URL.
- **Suite de tests y typecheck**: 7 suites / 56 tests de la superficie de billing en
  verde; el único error de `tsc --noEmit` en el repo es el mismatch conocido de la
  versión de `stripe` documentado en `AGENTS.md` (instalado localmente con bun),
  **fuera del alcance de esta revisión**.

---

## 9. Recomendación

1. **CR-1 antes de la próxima release.** Es el único hallazgo con impacto directo de
   takeover de cuenta.
2. **AL-1 y AL-2** a continuación: AL-1 rompe un flujo de producción (hands-free) y
   AL-2 contradice un invariante explícito de `AGENTS.md`.
3. **MD-1, MD-2 y MD-9** como paquete: son la misma raíz (el matcher no llega al
   usuario) y se arreglan juntos.
4. **MD-3, MD-4 y MD-5** como paquete: son la máquina de estados del rehearsal, y
   cada uno por separado hace avanzar la escena de más.
5. El resto puede entrar en el próximo ciclo.

**Nota operativa:** el repo **no tiene** `.github/copilot-instructions.md` — `.github/`
contiene únicamente `workflows/ci.yml`. Existe `AGENTS.md` en la raíz, que Copilot lee,
pero un `copilot-instructions.md` con los invariantes de billing (webhook como único
escritor, idempotency keys) y el flujo de deploy (branch → PR → CI → merge) elimina
la mayoría de los desvíos que el agente dejó en el historial.
