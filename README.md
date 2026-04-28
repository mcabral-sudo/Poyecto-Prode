# Prode Mundial 2026 - Sistema interno para empresa

Este proyecto reemplaza el prototipo basado en `localStorage` por una aplicación real para usar dentro de la red interna de la empresa.

## Qué cambia respecto del HTML original

- Los datos ya no se guardan en cada navegador.
- Hay un servidor central.
- La base de datos es compartida.
- Las contraseñas se guardan hasheadas.
- Hay sesiones de usuario.
- El administrador puede cargar resultados, bloquear usuarios, resetear contraseñas y exportar usuarios.
- El ranking es común para todos los usuarios.

## Requisitos

Instalar Node.js LTS en la computadora/servidor de la empresa.

Verificar instalación:

```bash
node -v
npm -v
```

## Instalación

1. Descomprimir esta carpeta en el servidor.
2. Abrir una terminal dentro de la carpeta.
3. Instalar dependencias:

```bash
npm install
```

4. Copiar `.env.example` como `.env`.

En Windows CMD:

```cmd
copy .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

5. Editar `.env` y cambiar especialmente:

```env
SESSION_SECRET=cambiar-por-una-clave-larga-y-secreta
ADMIN_PASSWORD=CambiarEstaClave123!
```

6. Iniciar:

```bash
npm start
```

## Ingreso desde la red interna

En el servidor se verá algo como:

```text
Prode corriendo en http://localhost:3000
En red interna: http://IP-DEL-SERVIDOR:3000
```

Desde otra PC de la empresa ingresar en el navegador a:

```text
http://IP-DEL-SERVIDOR:3000
```

Ejemplo:

```text
http://192.168.1.50:3000
```

## Importante

El firewall de Windows del servidor debe permitir conexiones entrantes al puerto 3000.

También se puede cambiar el puerto en `.env`:

```env
PORT=3000
```

## Usuario administrador inicial

Se crea automáticamente con los datos del archivo `.env`.

Ejemplo:

```env
ADMIN_USER=admin
ADMIN_EMAIL=admin@empresa.local
ADMIN_PASSWORD=CambiarEstaClave123!
```

Luego de entrar por primera vez, conviene cambiar esa clave en el archivo `.env` para futuras reinstalaciones, o crear otro usuario administrador desde base de datos si luego se amplía el sistema.

## Base de datos

La base se guarda en:

```text
data/prode.sqlite
```

Conviene hacer backup periódico de la carpeta `data`.

## Para dejarlo funcionando siempre en Windows

Opción simple: usar PM2.

```bash
npm install -g pm2
pm2 start server.js --name prode-mundial
pm2 save
pm2 startup
```

También puede configurarse como servicio de Windows con NSSM.

## Nota sobre fechas y partidos

Los partidos y horarios fueron cargados según el archivo original. Antes de publicar el Prode definitivamente, conviene verificar calendario oficial, fechas y horarios de Argentina.


## Cambios agregados en esta versión

- Los campos de campeón, subcampeón y semifinalistas ahora son listas desplegables.
- La instancia de Argentina y el resultado final de Argentina ahora usan lista desplegable de fases.
- El administrador cuenta con una nueva pestaña **Pronósticos**, donde puede ver una tabla completa con los pronósticos cargados por cada usuario.
- La tabla de pronósticos también puede exportarse a CSV.

## Archivos principales modificados

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css` no requiere cambios obligatorios para estas funciones, pero mantiene el estilo responsive.


## Cambios de esta versión

- Se reemplazó el término "tendencias" por "aciertos parciales".
- En Inicio se agregaron dos apartados públicos:
  - Premios
  - Noticias
- En Admin se agregó la pestaña "Premios y noticias" para cargar publicaciones.
- Las publicaciones pueden quedar publicadas u ocultas.
- Las publicaciones tienen campo "orden" para definir prioridad visual.
- La pestaña Admin > Pronósticos mantiene una matriz de control con resultados cargados al principio.

## Uso sugerido para Premios y Noticias

1. Entrar como administrador.
2. Ir a Admin > Premios y noticias.
3. Elegir tipo:
   - Premio
   - Noticia
4. Completar título, detalle y orden.
5. Marcar o desmarcar "Publicado en Inicio".
6. Guardar.

Los usuarios verán esos contenidos en la página de Inicio.

## Crédito interno

La interfaz incluye un pie de página visible con el texto:

```text
Sistema desarrollado internamente por Administración / RRHH – Parque de Descanso.
```
