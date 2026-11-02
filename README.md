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

## Publicar unidades nuevas

```
node tools/build.mjs <carpeta con L01.json, P01.json…> <path.json>
```

Valida cada unidad (`tools/validate.cjs`), escribe `data/` y pone una versión nueva en `sw.js`, para que la app instalada descargue lo nuevo.
