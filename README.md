# Felipe Fidel · Baby Shower Quiz

App web lista para subir a GitHub Pages y usar en el baby shower.

## Qué trae

- Alta de invitados con nombre + sticker (50 stickers incluidos)
- Desempate por medición de la panza cargado al entrar
- Perfil de **papás de Felipe Fidel** para controlar el juego
- Perfil de **invitado** para responder desde el celu
- Perfil de **pantalla / TV** para mostrar ganador y ranking en vivo
- Ranking animado cuando alguien sube o baja posiciones
- 12 preguntas ya configuradas con estos resultados:
  - 1: 40
  - 2: 44
  - 3: 2013
  - 4: 18299
  - 5: 1934
  - 6: 2001
  - 7: 7
  - 8: 151
  - 9: 7
  - 10: 39
  - 11: 700
  - 12: 3350

---

## Estructura del proyecto

- `index.html` → la app
- `styles.css` → UI / animaciones
- `app.js` → lógica general
- `stickers.js` → 50 stickers seleccionables
- `config.js` → configuración real
- `config.example.js` → plantilla
- `supabase-schema.sql` → base en Supabase

---

## Cómo dejarla funcionando

### 1) Crear un proyecto en Supabase

En Supabase copiá:
- `Project URL`
- `anon public key`

### 2) Ejecutar la base

Abrí el **SQL Editor** y pegá el contenido de:

`supabase-schema.sql`

Eso crea:
- `game_state`
- `players`
- `guesses`
- realtime para las tres tablas

### 3) Configurar la app

Editá `config.js` y completá:

```js
export const APP_CONFIG = {
  EVENT_NAME: 'Felipe Fidel · Baby Shower Quiz',
  EVENT_SUBTITLE: '¿Quién estuvo más cerca?',
  ADMIN_PIN: 'FELI2026',
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_ANON_KEY',
  QUESTIONS: [40, 44, 2013, 18299, 1934, 2001, 7, 151, 7, 39, 700, 3350],
  SHOW_TOP_ON_GUEST: 5
};
```

### 4) Subir a GitHub

Subí todos los archivos a un repositorio.

### 5) Activar GitHub Pages

En el repo:
- `Settings`
- `Pages`
- `Deploy from a branch`
- branch `main`
- folder `/root`

Y listo.

---

## Cómo se usa en el evento

### Invitados

1. Entran al link.
2. Tocan **Entrar como invitado**.
3. Se registran con nombre + sticker + número para desempate.
4. Esperan que los papás habiliten cada pregunta.
5. Responden desde el celu con números solamente.
6. Cuando se revela, ven:
   - respuesta correcta
   - cuánto les faltó o cuánto se pasaron
   - si ganaron o no la ronda

### Papás de Felipe Fidel

1. Entran a **Perfil de papás de Felipe Fidel**.
2. Usan el PIN definido en `config.js`.
3. Desde ahí pueden:
   - abrir o cerrar inscripción
   - guardar la medición real de la panza
   - abrir una pregunta
   - revelar resultado
   - pasar a la siguiente pregunta
   - reiniciar el evento

### Pantalla / TV

1. Abrí el mismo link.
2. Entrá a **Pantalla de resultados**.
3. Dejala abierta en la tele.
4. La tabla se actualiza sola en tiempo real.

---

## Importante

La app está pensada para un evento familiar y por eso usa políticas abiertas en Supabase para simplificar el uso. Funciona perfecto para el baby shower.

Si después querés una versión más blindada, la mejor mejora es pasar las acciones sensibles del panel de papás a Edge Functions.

---

## Personalizaciones rápidas

### Cambiar PIN de papás

Editá en `config.js`:

```js
ADMIN_PIN: 'TU_PIN'
```

### Cambiar cantidad de preguntas

Cambiá el array `QUESTIONS` en `config.js`.

### Cambiar nombre del evento

Editá:

```js
EVENT_NAME
EVENT_SUBTITLE
```

---

## Sugerencia para el evento

Abrí al mismo tiempo:
- 1 pestaña en modo **admin** para ustedes
- 1 pestaña en modo **board** en la tele
- el link general para invitados por QR

