# Compartir MorphIQ por web

Un solo despliegue sirve la app y la API desde el mismo dominio, y esa app se
puede instalar en el móvil como una PWA. El APK sigue funcionando igual.

> **Léete el paso 1 antes de compartir el link.** El orden importa: si el
> despliegue se abre antes de cerrar el acceso, cualquiera que entre ve la base
> de datos entera.

## 1. Variables en Vercel

```bash
# Quién se queda con los perfiles que existían antes de que hubiera cuentas.
# Sin esto no se adopta nada, y el historial actual queda sin dueño y sin verse.
echo -n "marchee72@gmail.com" | npx vercel env add OWNER_EMAIL production

# Audiencias aceptadas para el ID token de Google, y la firma de las sesiones.
echo -n "1041470263665-0a3d4du9omjk10rk7uhf9frgo7e26tq6.apps.googleusercontent.com" \
  | npx vercel env add GOOGLE_WEB_CLIENT_ID production
echo -n "1041470263665-s3qncp78imfq8gd0kdt6kd1ef3fdakqc.apps.googleusercontent.com" \
  | npx vercel env add GOOGLE_ANDROID_CLIENT_ID production
echo -n "<48 bytes aleatorios>" | npx vercel env add SESSION_SECRET production

# El cliente. VITE_ se resuelve al construir, no en ejecución.
echo -n "server" | npx vercel env add VITE_DB_TYPE production
echo -n "1041470263665-0a3d4du9omjk10rk7uhf9frgo7e26tq6.apps.googleusercontent.com" \
  | npx vercel env add VITE_GOOGLE_CLIENT_ID production
```

`VITE_API_URL` **no hace falta**: servidos desde el mismo dominio, el cliente
usa su propio origen. Solo se pone si la API vive en otro sitio — que es el caso
del APK, donde sí es obligatoria porque el WebView se sirve de `localhost`.

En Google Cloud → Credenciales → cliente web, el dominio del despliegue tiene
que estar en **orígenes autorizados de JavaScript**, o el login web no arranca.

## 2. Orden de encendido

`AUTH_REQUIRED` va en dos tiempos, y saltárselo rompe el móvil que ya tienes
instalado.

```bash
# a) Permisivo. Se despliega y todo sigue funcionando como hasta ahora.
echo -n "false" | npx vercel env add AUTH_REQUIRED production
npm run deploy:api

# b) Entra tú, desde web y desde el APK, con la cuenta de OWNER_EMAIL.
#    Esa primera entrada es la que adopta tu historial. Comprueba que lo ves.

# c) Solo entonces, cerrar la puerta.
echo -n "true" | npx vercel env add AUTH_REQUIRED production --force
npm run deploy:api
```

Comprobación de que quedó cerrado:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://morphiq-eight.vercel.app/api/profiles
# 401 = correcto. 200 = AUTH_REQUIRED no se aplicó.
```

## 3. Qué ve quien abra el link

Con `AUTH_REQUIRED=true`, una pantalla de acceso. Al entrar con su Google se
crea su cuenta, hace su propio onboarding, y a partir de ahí:

- solo ve sus perfiles — `GET /api/profiles` filtra por `user_id`;
- no puede leer ni borrar filas de nadie más, ni adivinando ids: cada ruta que
  direcciona una fila por id o acepta un `profileId` pasa por los guardas de
  `server/auth.js`, con tests en `server/__tests__/ownership.test.js`;
- no hereda nada tuyo — la adopción de perfiles huérfanos está limitada a
  `OWNER_EMAIL`;
- no deja rastro en ninguna caché: `/api` responde `Cache-Control: no-store`.
  El valor por defecto de Vercel es `public, max-age=0, must-revalidate` con un
  `Vary: Origin` que **no** incluye `Authorization` — es decir, dos cuentas en
  el mismo origen comparten entrada de caché. El `must-revalidate` lo salva en
  la práctica, pero datos de una cuenta no deben almacenarse, y menos en el
  disco de un móvil compartido.

## Comprobar que quedó bien

```bash
B=https://morphiq-eight.vercel.app
curl -s $B/api/health | grep -o '"authRequired":[a-z]*'          # true
curl -s -o /dev/null -w "%{http_code}\n" $B/api/profiles          # 401
curl -s -D - -o /dev/null $B/api/profiles | grep -i cache-control # no-store

# El login NO puede estar detrás del muro, o no entra nadie — ni tú.
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'Content-Type: application/json' -d '{}' $B/api/auth/google  # 400, no 401
```

Y antes de encender `AUTH_REQUIRED`, que tus perfiles tengan dueño — si el
`user_id` sale NULL, cerrar te deja fuera de tu propio historial:

```bash
curl -s $B/api/profiles | node -e "let d='';process.stdin.on('data',c=>d+=c)
  .on('end',()=>JSON.parse(d).forEach(r=>console.log(r.id, r.user_id)))"
```

## 4. Instalarla como app

En Android/Chrome sale sola la opción, y además hay un botón en **Ajustes →
Instalar MorphIQ**. En iPhone, Safari → Compartir → Añadir a pantalla de inicio;
Ajustes muestra esas instrucciones porque iOS no expone ninguna API.

El service worker (`public/sw.js`) guarda el shell y los assets con hash, así
que la app abre sin conexión. **Nunca guarda `/api/`**: esas respuestas son los
datos de una cuenta y la caché es del navegador, no de la sesión.

## 5. Probar el bundle antes de compartir

```bash
npm run build
npx vite preview --port 4173
```

`http://localhost:4173` está en la lista de orígenes de CORS del servidor a
propósito, para que esta comprobación llegue a la API de verdad.
`?db=local` fuerza el modo local si quieres ver la app sin cuenta.
