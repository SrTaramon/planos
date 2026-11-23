# Planos

Una app para aprender system design paso a paso, en español: 28 lecciones cortas y los 55 problemas de [systemdesign.io](https://systemdesign.io/) guiados, en una ruta de 10 módulos. Unos 25 minutos al día, a tu ritmo.

**Ábrela:** https://srtaramon.github.io/planos/

## Instalarla en el iPhone

1. Abre la dirección en **Safari**.
2. Pulsa **Compartir** y luego **«Añadir a pantalla de inicio»**.
3. Abre **Planos** desde el icono y pulsa **«Activar avisos»** (hace falta iOS 16.4 o posterior).

Usa siempre la app del icono: el progreso y las notas se guardan en ella, en el propio iPhone. Desde **Ajustes** puedes copiar el progreso para guardarlo en Notas y restaurarlo después.

## Cómo funciona

- Es una web estática (GitHub Pages) que se instala como app y funciona sin conexión: el service worker (`sw.js`) guarda la app y todas las lecciones.
- La ruta está en `data/path.json` y cada unidad en `data/units/<id>.json`.
- **El aviso de cada mañana** lo envía una tarea programada de Claude con Web Push (`tools/send-push.mjs`, sin dependencias; su test reproduce el ejemplo del RFC 8291). El aviso llega vacío y el texto («Hoy en Planos…») lo calcula el propio iPhone con su progreso (`core.js`). La clave privada y la suscripción no están en este repositorio.

- **«Míralo en acción»**: cada lección (y cada problema, al terminarlo) tiene una escena: un plano animado que se recorre paso a paso, con paquetes que viajan, piezas que se saturan o se caen, cifras que mejoran o empeoran y preguntas para predecir lo que pasará. El motor es `scene.js` (SVG y `requestAnimationFrame`, sin dependencias) y las escenas están en `scenes/`. Cómo se escriben: [`scenes/README.md`](scenes/README.md).
- Las preguntas («Comprueba que lo tienes», «Ponte a prueba») son casos nuevos, no frases del texto, y algunas llevan un mini plano. Entran en el repaso espaciado.

## Publicar

```
node tools/build.mjs                                   # escenas nuevas o cambios en data/units
node tools/build.mjs <carpeta con L01.json…> <path.json>  # unidades nuevas desde otra carpeta
```

Valida las unidades (`tools/validate.cjs`) y las escenas (`tools/validate-scene.cjs`), escribe `data/` y pone una versión nueva en `sw.js`, para que la app instalada descargue lo nuevo. `node tools/check-scenes.mjs scenes/L11.json --shots <carpeta>` dibuja cada paso como en un iPhone y avisa si se pisan textos (necesita Playwright).
