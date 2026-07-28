# Activar el login de Google

El código está listo. Faltan las variables de entorno en Vercel y el despliegue,
en un orden concreto.

## 1. Variables en Vercel

Desde la raíz del proyecto:

```bash
# Audiencias aceptadas para el ID token de Google
echo -n "1041470263665-0a3d4du9omjk10rk7uhf9frgo7e26tq6.apps.googleusercontent.com" \
  | npx vercel env add GOOGLE_WEB_CLIENT_ID production

echo -n "1041470263665-s3qncp78imfq8gd0kdt6kd1ef3fdakqc.apps.googleusercontent.com" \
  | npx vercel env add GOOGLE_ANDROID_CLIENT_ID production

# Firma las sesiones de la app. ESTE SÍ es secreto.
echo -n "Cm5Xwj__mGqs-ZlJpCai1ByndeIFElJKW85QtvHoHDbN9VE6ijhX4_Cx6518OmxA" \
  | npx vercel env add SESSION_SECRET production

# Arranca en modo permisivo: la app que ya tienes instalada sigue funcionando.
echo -n "false" | npx vercel env add AUTH_REQUIRED production
```

O por la interfaz web: **Vercel → morphiq → Settings → Environment Variables**.

`SESSION_SECRET` está generado con 48 bytes aleatorios. Si lo cambias más
adelante, todas las sesiones activas se invalidan y hay que volver a entrar.

## 2. Desplegar

```bash
npm run deploy:api
npm run check:api          # verifica que no falte ningún endpoint
```

Al arrancar aplica `migrations/001_auth.sql`: crea la tabla `users` y añade
`user_id` a `user_profiles`. Es idempotente, se puede repetir sin daño.

## 3. Probar el login

```bash
npm run dev
```

Abre `http://localhost:5173`, ve a Ajustes → Cuenta → **Continuar con Google**.

La respuesta trae `adoptedProfiles`. Debería ser **1**: tu perfil "Alex" y todo
su historial pasan a tu cuenta. Ese paso solo ocurre una vez — después ningún
perfil queda sin dueño, así que el UPDATE ya no encuentra nada.

Comprueba que sigues viendo tus datos. Si algo falla, `?db=local` sigue
funcionando sin cuenta y sin servidor.

## 4. Móvil

```bash
npm run deploy:mobile
```

Ajustes → Cuenta → Continuar con Google. Debe reconocer la misma cuenta y los
mismos datos que en web.

## 5. Cerrar la puerta

Solo cuando **ambos** clientes entren bien:

```bash
echo -n "true" | npx vercel env add AUTH_REQUIRED production --force
npm run deploy:api
```

A partir de aquí la API devuelve 401 sin sesión. Comprueba que el agujero está
cerrado:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://morphiq-eight.vercel.app/api/profiles
# 401 = correcto. 200 = AUTH_REQUIRED no se aplicó.
```

## Por qué este orden

Si activas `AUTH_REQUIRED` antes de publicar los clientes, la app instalada en tu
teléfono deja de funcionar hasta que la actualices. El modo permisivo existe para
que las dos partes puedan moverse por separado.

## Antes de publicar una release

La SHA-1 del keystore de release es **distinta** de la de debug. Hay que añadirla
al mismo client de Android en Google Cloud, o el login funcionará en tus pruebas
y se romperá justo al publicar.

Debug (ya registrada): `25:96:ED:C0:7A:EC:DF:3A:D8:03:EA:14:A5:0A:4B:0C:C2:A5:4D:7D`
