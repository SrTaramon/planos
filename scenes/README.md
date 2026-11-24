# Escenas: «Míralo en acción»

Cada lección puede tener una escena: un plano animado que se recorre paso a paso. Las piezas aparecen,
cambian o se caen, y por las conexiones viajan peticiones, respuestas y fallos. Arriba, unas cifras
dicen qué pasa (latencia, errores, hit rate…) y si mejora o empeora. La app la enseña al principio de la
lección, después del gancho; el texto de la lección sigue debajo, para profundizar.

- Fuente: `scenes/Lxx.json` (este directorio). El build las valida y las copia a `data/scenes/`.
- Motor: `scene.js`. Reproductor: `sceneCard` en `app.js`.
- Validar: `node tools/validate-scene.cjs scenes/L12.json`
- Ver cómo queda en un iPhone y si algo se pisa: `node tools/check-scenes.mjs scenes/L12.json --shots <carpeta>`
- La de referencia: `scenes/L11.json` (consistent hashing).

## La escena ES la lección (`"lesson": true`)

Desde noviembre de 2026 una lección no se cuenta dos veces: su escena lleva `"lesson": true` y la app ya
no enseña las secciones de teoría (`sections`) ni «Lo que te llevas». Cada paso es plano + explicación:

- `body` (≤ 900): la explicación de ese momento, **con la teoría de la lección que le toca**. 2-3 párrafos
  cortos o una lista; se lee en una pantalla de iPhone debajo del plano.
- `more` (≤ 1.800, opcional): «Saber más», plegado. Lo técnico que no cabe en el cuerpo: tablas, código,
  cifras de detalle, ejemplos extra, «dónde se usa».
- **No se pierde nada**: todo lo que contaban las `sections` de la lección (ideas, ejemplos, tablas, código,
  callouts) está en algún `body`, `callout` o `more`. Si hace falta, añade un paso (10 como mucho).
- El último paso (`recap`) se titula «Lo que te llevas» y su cuerpo son las `keyIdeas` de la lección.
- Sin `goals` (ya no se enseñan). `changes`, como mucho 3 y cortos.
- La referencia es `scenes/L11.json`.

## Cómo se cuenta

Como una historia corta, de 5 a 8 pasos (10 como mucho), unos 3-4 minutos en total:

1. **Problema** (`problem`): una situación concreta que duele. Nada de definiciones al principio.
2. **Técnica** (`technique`) y **Solución** (`solution`): la idea que lo arregla, una cosa por paso.
3. **Caso** (`case`): qué pasa cuando algo sale mal o cambia (se cae un nodo, llega un pico, un usuario
   lejos). Uno o dos.
4. **Repaso** (`recap`): el último paso, con una lista corta de lo visto.

Cada paso cambia algo visible en el plano: una pieza que aparece o se cae, un flujo nuevo, una cifra
que mejora o empeora. Si un paso no cambia nada en el plano, sobra o se junta con otro.

Los números y los ejemplos son los de la lección (`data/units/Lxx.json`): la escena la ilustra, no la
contradice. En castellano, con los términos técnicos en inglés, como el resto de la app. Sin nombres de
personas reales ni de la persona que estudia.

## Formato

```jsonc
{
  "id": "L12",                       // el de la lección
  "title": "La cola, en acción",     // ≤ 60
  "metrics": [                       // 0-4 cifras que se ven arriba en todos los pasos
    { "id": "p95", "label": "Latencia p95", "unit": "ms", "better": "low" },
    { "id": "lost", "label": "Pedidos perdidos", "better": "low" }
  ],
  "legend": { "event": "pedido en la cola" },   // opcional: otro nombre para un tipo de paquete
  "goals": [ { "text": "Por qué…", "step": 2 } ], // 2-5: «Lo que verás», se marcan al llegar a ese paso
  "steps": [ { …paso… } ]
}
```

Un paso:

```jsonc
{
  "short": "Pico",                        // ≤ 14: el nombre en la línea de pasos y en «Siguiente: …»
  "chapter": "problem",                   // problem | technique | solution | case | recap
  "title": "Llega el Black Friday",       // ≤ 64
  "body": "Markdown (≤ 520; ≤ 900 en una lección-escena). `código`, **negrita**, listas con «- ».",
  "more": "Opcional: «Saber más», plegado (≤ 1.800). Tablas, código, detalle.",
  "callout": { "type": "warn", "text": "≤ 220" },   // insight (Idea clave) | tip (Truco) | warn (Ojo)
  "changes": ["+ Cola", "~ p95: 2 s → 80 ms", "− Llamada directa"],  // ≤ 4: «+» nuevo, «~» cambia, «−» se quita
  "metrics": { "p95": 2000, "lost": "3 %" },   // número (se compara con el paso anterior) o texto
  "panel": { "title": "La cuenta", "rows": [ { "text": "0,95×1 + 0,05×20 = 2 ms", "tone": "good" } ] },
  "nodes": [ … ], "links": [ … ], "flows": [ … ],
  "zones": [ { "label": "Región UE", "from": [0, 0], "to": [1, 2], "tone": "good" } ],
  "ring": { "center": [1.5, 1.6], "radius": 1.25, "label": "…", "ticks": [ { "a": 30, "c": 0 } ] }
}
```

- `metrics`: con `better` (`low` o `high`) la cifra sale en verde o en rojo, con flecha, cuando cambia
  respecto al paso anterior. Sin `better`, solo flecha. Un texto (`"3 %"`, `"sí"`) no se compara.
- `panel` (opcional): una pizarra debajo del plano para una cuenta o una comparación (≤ 5 filas de ≤ 60;
  `tone`: `good` verde, `bad` rojo). Úsala cuando el número es la lección.

### Piezas (`nodes`)

```jsonc
{ "id": "db", "kind": "db", "label": "Postgres", "at": [1, 2],
  "note": "réplica", "load": 0.8, "badge": "3 s", "state": "hot", "mark": "bad", "items": ["k1", "k2"] }
```

- `kind`: `client` (un dispositivo), `users` (mucha gente), `lb`, `service`, `worker`, `cache`, `db`,
  `storage`, `queue`, `stream`, `cdn`, `search`, `external`, `lock`, `clock`.
- `at`: `[columna, fila]` en una cuadrícula. **Columnas 0-3 y filas 0-6**; se admiten decimales
  (`1.5`). Una columna mide 100 y una fila 112: dos piezas en la misma fila necesitan al menos 0,75
  columnas entre ellas, y una pieza con `load`/`badge`, una fila entera (1) con la de arriba.
- `label` ≤ 14 (mejor ≤ 10 si hay piezas al lado), `note` ≤ 18, `badge` ≤ 12, `items` ≤ 3 de ≤ 7.
- `load` 0-1: una barra encima (verde, ámbar desde 0,6, roja desde 0,85).
- `state`: `ok`, `hot` (saturada: roja y con pulso), `down` (caída: gris con una X), `dim` (apagada:
  lo que existe pero no importa en este paso).
- `mark`: `good` o `bad`, un halo debajo para señalar la pieza de la que habla el paso.
- Una pieza que no estaba en el paso anterior aparece con una animación: no hace falta marcarla.
- **Mantén cada pieza en la misma posición en todos los pasos** salvo que el cambio sea la lección. El
  encuadre es el mismo para toda la escena (el de todas las piezas de todos los pasos): si un paso usa
  una zona del plano que los demás no, los demás quedan con hueco.

### Conexiones (`links`) y lo que viaja por ellas (`flows`)

```jsonc
{ "id": "app-db", "from": "app", "to": "db", "label": "SELECT …", "state": "hot", "dashed": true, "bend": 0.3, "arrow": true }
{ "via": ["users-lb", ["lb-a", "lb-b", "lb-c"]], "kind": "req", "back": "resp", "rate": 2 }
```

- Una conexión es una línea recta entre dos piezas; `bend` (-1 a 1) la curva; `label` ≤ 16 a mitad.
- Un flujo lanza paquetes por un recorrido de conexiones seguidas (cada una empieza donde acaba la
  anterior). Un elemento que es una lista (`["lb-a", "lb-b"]`) es una bifurcación: cada paquete coge
  una rama, por turnos (`"pick": "random"` para al azar). Repetir una rama le da más peso.
- `kind`: `req` (petición, naranja), `resp` (respuesta, verde), `write` (escritura, cuadrado azul),
  `event` (evento o mensaje, rombo morado), `ping` (health check, aro), `heavy` (petición pesada,
  cuadrado grande), `fail` (falla).
- `back`: al llegar, vuelve por el mismo camino con ese tipo (normalmente `resp`). `wait`: ms que
  espera antes de volver (una consulta lenta).
- `fail: true`: el paquete revienta al llegar, con una X. `failAt: 0.5`: revienta a mitad.
- `rate`: paquetes por segundo (0,15-8). 1-3 es lo normal; más, para un pico.
- `pop: true`: un destello verde al llegar (un dato que se entrega, una clave que se mueve).

### Predecir antes de ver (`predict`)

Un paso puede llevar una pregunta sobre **lo que enseñará el paso siguiente**: «¿Qué crees que pasará
si…?». Se responde, se ve si acertaste y el botón pasa a «Verlo: …». Es lo que más fija lo aprendido:
pon 1 o 2 por escena, en los momentos clave (justo antes del problema o del cambio que la escena quiere
enseñar). Nunca en el último paso.

```jsonc
"predict": {
  "q": "Ahora añades un quinto nodo y la regla pasa a % 5. ¿Qué parte de las claves cambia de nodo?",
  "options": ["Una de cada cinco", "La mitad", "Cuatro de cada cinco", "Todas"],
  "answer": 2,
  "explain": "Solo se queda en su sitio la clave cuyo hash da el mismo resto entre 4 y entre 5: una de cada cinco."
}
```

## Preguntas que hacen pensar

Lo mismo vale para las comprobaciones de las lecciones («Comprueba que lo tienes», `checks` en
`data/units/Lxx.json`) y de los problemas («Ponte a prueba», `checks` en `data/units/Pxx.json`), que
además entran en el repaso espaciado. Formato: `{ "q", "options" (2-4, ≤ 150), "answer", "explain" (≤ 420), "scene"? }`.

Una pregunta no se responde reconociendo una frase del texto: se responde **usando** la idea.

- **Prohibido** «¿Qué es X?» o «¿Qué hace X?» con la definición del texto como respuesta correcta, y
  cualquier opción correcta copiada de la lección.
- **Sí:** un caso nuevo («Una tienda con…»), una cuenta con otros números, «¿qué se rompe si…?», «¿qué
  pasa con la clave Y si añades el nodo Z?», elegir entre dos diseños para una situación, encontrar el
  fallo de un diseño, ordenar lo que ocurre.
- Los distractores son los **errores típicos** de quien está aprendiendo, plausibles, de la misma
  longitud que la buena; nunca absurdos. Ni «todas las anteriores» ni la buena siempre en la misma letra.
- `explain` dice por qué la buena es buena **y** por qué falla el error más tentador.
- Al menos una de cada lección o problema lleva un **mini plano** (`scene`): un paso de escena sin
  textos (`nodes`, `links`, `flows`, `zones`, `ring`), con el mismo formato de arriba. La pregunta se
  responde mirándolo: «¿Cuál es aquí el punto único de fallo?», «¿Por dónde pasa la petición de luis?».

## Comprobar antes de darla por buena

1. `node tools/validate-scene.cjs scenes/Lxx.json`: el formato y los límites. Para las preguntas de una
   unidad, `node tools/validate.cjs data/units/Lxx.json`.
2. `node tools/check-scenes.mjs scenes/Lxx.json --shots <carpeta>`: dibuja cada paso como en un iPhone y
   avisa si dos textos se pisan, si algo se sale o si las etiquetas quedan por debajo de 9 px. Abre las
   capturas y míralas: el comprobador no ve una pieza tapada por una línea ni un plano que no se
   entiende.
3. `node tools/build.mjs` (sin argumentos) la publica en `data/scenes/` y cambia la versión.
