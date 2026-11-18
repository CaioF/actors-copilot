# Pruebas de navegador grabadas

Desde la raíz del repositorio, instala Node 22 LTS, pnpm 9 y el navegador fijado por Playwright. FFmpeg del sistema se usa para el montaje y la comprobación final. El grabador usa el codificador que instala Playwright.

```sh
pnpm install --frozen-lockfile
pnpm --dir qa/recording install --frozen-lockfile
pnpm --dir qa/recording exec playwright install chromium
node qa/recording/record.mjs coach-fixture
```

El último comando abre Chromium en un contexto nuevo, monta la página real de Acting Coach con datos ficticios, cambia de modo, escribe la pregunta, la envía y comprueba que parte de la respuesta recibida aparece en la burbuja del asistente. Verás «Local component demo» en pantalla. El servidor, el encabezado, el enrutador y el estado de conversación se sustituyen en este ensayo. Funciona sin credenciales. En Linux, añade `--with-deps` a la instalación del navegador si faltan bibliotecas del sistema.

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
