# Encuentro familiar

Formulario web para coordinar la celebración de los cumpleaños de los abuelos: disponibilidad, fecha recomendada e ideas de actividades.

## Ejecutar

Abre `index.html` en un navegador moderno. No requiere instalación ni dependencias externas. Para publicarlo con GitHub Pages, sirve estos archivos desde la raíz del repositorio.

## Funciones

- Recoge nombre de familia, número de asistentes, fechas disponibles, periodos preferidos e ideas.
- Sugiere el mejor día y una ventana consecutiva de dos días según las personas disponibles. Usa las preferencias de periodo para desempatar.
- Muestra votos por periodo y actividad, y una propuesta inicial de agenda.
- Permite editar o eliminar respuestas, imprimir el resumen y descargar CSV.
- Diseño adaptable a móviles; el texto ingresado se inserta como texto para evitar interpretarlo como HTML.

## Almacenamiento pendiente

Por ahora, las respuestas se guardan en `localStorage` del navegador. **No se comparten entre dispositivos ni familiares.** Al elegir una base de datos, habrá que reemplazar ese almacenamiento por un endpoint seguro y configurar permisos de lectura y escritura. No pongas credenciales privadas en `app.js` ni en `index.html`.

## Fechas

Se conservaron las fechas del código original: cumpleaños del abuelo el 8 de diciembre y de la abuela el 22 de enero. El formulario considera el periodo del 1 de diciembre de 2026 al 15 de febrero de 2027.

## Pruebas

Con Node.js instalado, ejecuta desde la raíz:

```sh
node --test family-logic.test.cjs
```
