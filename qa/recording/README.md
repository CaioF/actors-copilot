# Pruebas de navegador grabadas

Desde la raíz del repositorio, instala Node 22 LTS, pnpm 9 y el navegador fijado por Playwright. FFmpeg del sistema se usa para el montaje y la comprobación final. El grabador usa el codificador que instala Playwright.

```sh
pnpm install --frozen-lockfile
pnpm --dir qa/recording install --frozen-lockfile
pnpm --dir qa/recording exec playwright install chromium
node qa/recording/record.mjs coach-fixture
```

El último comando abre Chromium en un contexto nuevo, monta la página real de Acting Coach con datos ficticios, cambia de modo, escribe la pregunta, la envía y comprueba que parte de la respuesta recibida aparece en la burbuja del asistente. Verás «Local component demo» en pantalla. El servidor, el encabezado, el enrutador y el estado de conversación se sustituyen en este ensayo. Funciona sin credenciales. En Linux, añade `--with-deps` a la instalación del navegador si faltan bibliotecas del sistema.

## Cupón de afiliado y verificación en admin, en una sola toma

El grabador abre Economy mensual desde la aplicación de producción, escribe `LUCAS` en Stripe y compara el resultado con el de una cuenta que entra por el enlace de Lucas. En esa misma pestaña abre el panel, comprueba las dos cuentas y busca en **Affiliates** el código que acaba de leer en Stripe. La grabación conserva los clics y las esperas a velocidad real.

### Preparación

Instala Chromium con los comandos anteriores y usa FFmpeg con el codificador H.264 `libx264`. Desde la raíz del repositorio, guarda estas variables en `qa/recording/.env.affiliate-coupon.local` o expórtalas al proceso. El archivo local está ignorado por Git.

| Variables | Cuenta o valor que se necesita |
|---|---|
| `AC_TEST_EMAIL`, `AC_TEST_PASSWORD` | **A**. Una cuenta de prueba Free, creada sin referencia y sin transacciones previas. En **Member dashboard → Referred by** debe figurar un guion largo (`—`). |
| `AC_REFERRED_EMAIL`, `AC_REFERRED_PASSWORD` | **B**. Otra cuenta de prueba Free que ya figure como `lucas` en **Referred by** y tenga disponible la oferta del afiliado. |
| `AC_ADMIN_USERNAME`, `AC_ADMIN_PASSWORD` | Operador con acceso a las tablas de miembros y afiliados. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clave pública de la aplicación para autenticar a los dos actores. |
| `AC_FFMPEG_PATH` | Ruta al ejecutable de FFmpeg si `ffmpeg` no está en el PATH. |

Usa Chromium con la configuración regional `en-US` que fija el grabador. La prueba comprueba los precios en USD. Las credenciales de servicio de Firebase y las claves privadas de Stripe quedan fuera de los requisitos.

```sh
node --env-file=qa/recording/.env.affiliate-coupon.local qa/recording/affiliate-coupon.mjs
```

### Qué hacer y qué observar

| Paso | Interacción | Evidencia visible |
|---|---|---|
| 1. Cuenta A | En `/upgrade` pulsa **Upgrade to Economy Class**. En Stripe pulsa **Add promotion code**, escribe las cinco letras de `LUCAS` y pulsa **Apply**. | El importe inicial es USD 19,00 tras el periodo de prueba y USD 0,00 hoy. Si se acepta, deben verse `LUCAS`, **20% off 1 billing cycle** y USD 15,20. Si Stripe muestra **This promotion code is invalid.**, el grabador comprueba que se mantienen los USD 19,00 y conserva el fallo en pantalla. |
| 2. Cuenta B | Usa la cuenta vinculada que entró por `/login?ref=lucas`. Vuelve a **Upgrade to Economy Class** y abre su checkout. | Al cargar aparecen el código, el descuento del 20 % durante un ciclo y los totales de USD 15,20 después de la prueba y USD 0,00 hoy. |
| 3. Miembros | Abre `/admin-dashboard` con la sesión del operador. Localiza cada fila por el correo exacto de su cuenta de prueba y revisa **Referred by**. | El video sustituye los nombres por **A · Entrada manual** y **B · Por enlace**. Los valores de referencia provienen de las celdas reales y deben coincidir con los que tenían las dos cuentas antes de abrir Stripe. |
| 4. Afiliados | Pulsa **Affiliates** y localiza la fila con el código observado en el checkout. | En la misma celda de **Affiliate** deben aparecer **Coupon code: LUCAS** y el enlace completo con `/login?ref=lucas`. Encontrarlos en filas distintas hace fallar la comprobación. |

Los inicios de sesión ocurren fuera de cámara. Antes del segundo actor se limpian los datos de la aplicación en el perfil temporal de Chromium. El operador usa su propia sesión autenticada. Cuando la cámara navega, la página empieza oculta y solo se muestran las regiones comprobadas. Los importes del plan y del descuento son visibles. Los datos de tarjeta, correos, otros miembros y saldos del afiliado quedan ocultos.

### Archivos y resultado

El comando imprime la carpeta `qa/recording/evidence/affiliate-coupon-<fecha-UTC>/`. Abre **affiliate.mp4** para ver el recorrido. **take.webm** es el original continuo y **report.json** conserva los hitos en milisegundos, los resultados por paso y los valores observados. El MP4 se genera a partir de ese único WebM y se decodifica completo al finalizar. La carpeta de evidencias queda fuera de Git.

| Código de salida | Interpretación |
|---|---|
| `0` | Las dos formas de aplicar el descuento y las dos tablas de admin pasaron. |
| `2` | La grabación llegó al final y admin se verificó. Stripe rechazó la entrada manual. El MP4 y el informe conservan ese resultado. |
| `1` | La ejecución se interrumpió. Si comenzó la prueba, consulta `failedStage` en el informe y la toma parcial cuando exista. |

Abrir el checkout puede crear o reutilizar un cliente y una sesión de Stripe. Ambos checkouts se dejan abiertos antes de confirmar el pago. El panel muestra la configuración del cupón y la atribución previa. Para acreditar una compra nueva, la aplicación procesa `checkout.session.completed`. [Creación de checkout](../../lib/billing-checkout.ts) · [Webhook de Stripe](../../app/api/webhooks/stripe/route.ts)

Para verificar el enmascaramiento localmente, el siguiente ensayo monta páginas sintéticas, prueba el caso de un cupón y un enlace en filas distintas y decodifica todos los fotogramas para detectar un campo privado de color conocido. También comprueba que se ve el marcador del cupón. Puedes usar `--env-file=qa/recording/.env.affiliate-coupon.local` si allí definiste la ruta a FFmpeg. CI ejecuta este ensayo sin credenciales.

```sh
node --test qa/recording/check-affiliate-screen.mjs
```

## Grabar los recorridos de la aplicación

Ejecuta estos comandos desde la raíz. La aplicación de destino predeterminada es `https://app.theactorscopilot.com`. Para una instancia local usa `AC_BASE_URL=http://localhost:3000`. El valor predeterminado incluye operaciones reales en los recorridos con `--submit`.

| Recorrido | Comando | Qué debe verse y qué comprueba |
|---|---|---|
| Afiliado, visitante | `node qa/recording/record.mjs affiliate` | La referencia abre el registro. Cambia a login, escribe una dirección ficticia y vuelve al registro. Comprueba que el navegador conserva el código. |
| Afiliado, checkout | `node qa/recording/record.mjs affiliate --submit` | Añade una sesión autenticada con una cuenta Free, cambia de anual a mensual y abre Economy. Comprueba LUCAS y 20 % en Stripe. La última toma muestra recortes de ambas etiquetas. Puede crear o reutilizar un cliente y una sesión de checkout. La grabación termina antes del pago. |
| Brief y sides | `node qa/recording/record.mjs brief` o `node qa/recording/record.mjs sides` | Desde el dashboard, abre la herramienta, teclea proyecto y rol, pega material original y revisa la ficha. Comprueba contenido y botón de generación disponible. Usa una cuenta con acceso a audiciones. |
| Desglose real | Añade `--submit` a brief o sides | Envía el material al analizador una vez. Exige la respuesta HTTP correcta, la cabecera del rol y el botón de guardado. El video llega al resultado. El guardado posterior requiere otro recorrido. |
| Coach, acceso | `node qa/recording/record.mjs coach` | Con Economy, comprueba la navegación a los planes. Con Business, abre una sesión nueva y prepara una pregunta. La aplicación guarda la sesión nueva. |
| Coach, conversación | `node qa/recording/record.mjs coach --submit` | Con Business, envía una pregunta sintética sobre Mara y compara la respuesta de la API con texto visible en la burbuja. Usa el proveedor real y guarda la conversación. |

Para cuentas autenticadas define `AC_TEST_EMAIL`, `AC_TEST_PASSWORD` y `NEXT_PUBLIC_FIREBASE_API_KEY` en el entorno del proceso. También puedes cargar los valores con Node. El siguiente ejemplo supone que guardaste la identidad QA en el archivo local ignorado indicado y que el proyecto público de Firebase corresponde al entorno elegido.

```sh
node --env-file=.env --env-file=qa/recording/.env.member.local qa/recording/record.mjs sides --submit
```

La preparación inicia sesión fuera de cámara mediante Firebase, el callback de la aplicación y el formulario de login. El navegador se cierra al finalizar. Usa identidades de prueba dedicadas con historial sintético. En el primer acceso el dashboard puede mostrar un video de bienvenida. El grabador usa el control para cerrarlo. Las sesiones Business anteriores se mantienen fuera de la grabación durante la preparación del Coach.

## Entrega y reproducción

Cada intento crea `qa/recording/evidence/<recorrido>-<fecha-UTC>/`. Los archivos WebM son las tomas originales. `report.json` indica entorno, navegador, tamaño, resultado, comprobaciones y tiempos relativos al inicio de cada toma. Un punto con tiempo nulo ocurrió fuera de cámara. Un intento que falla sale con código 1 y conserva el informe y, si llegó a grabar, el video parcial para diagnóstico. Revisa el último estado observable antes de repetir una operación que ya pudo llegar a Stripe o al modelo.

Para crear un MP4, pasa al siguiente comando los **nombres de directorios** de los intentos aprobados, en el orden que deben aparecer. Usa `AC_FFMPEG_PATH` si FFmpeg no está en PATH. El MP4 incluye capítulos navegables para saltar a cada recorrido en un reproductor compatible. El montaje añade cartelas, conserva la velocidad del teclado y marca cuántos segundos se recortaron durante una espera del analizador. Al final decodifica todo el MP4 con FFmpeg. Conserva los originales para investigar latencia. El ejemplo usa marcadores que debes sustituir por los nombres impresos al grabar.

```sh
node qa/recording/showcase.mjs <directorio-afiliado> <directorio-brief> <directorio-sides> <directorio-coach>
```

Antes de compartir, reproduce el MP4 a velocidad normal. En cada capítulo identifica el control elegido, el dato escrito o pegado y el cambio que demuestra el resultado. Pausa sobre el cupón, la cabecera del desglose y la respuesta del Coach. Comprueba que se leen a la escala de presentación y que los cortes quedan identificados. La ruta de evidencias completa, los videos, los informes y las credenciales locales están ignorados por Git. El trabajo de CI ejecuta y decodifica la conversación local, sin publicar los archivos.

Consulta los resultados de la comparación y los criterios para ampliar estos recorridos en [la investigación](research.md).
