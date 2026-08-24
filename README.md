# Sistema de Reservas

Sistema de reservas de canchas deportivas (fútbol 5/6/8/11), full-stack. Un
usuario ve la disponibilidad, reserva un horario, elige color de petos para
su equipo y paga (simulado); puede reagendar o cancelar después. Un admin
gestiona el catálogo de canchas y tiene visibilidad de todas las reservas
del sistema.

Este repositorio es el **backend** (API). El frontend vive en un repositorio
separado, `sistema-reservas-frontend`.

## Stack técnico

- **Backend** (este repo): NestJS 11 + TypeORM + PostgreSQL 16, autenticación
  JWT (`passport-jwt`), DTOs validados con `class-validator`, rate limiting
  con `@nestjs/throttler`, build Docker multi-stage.
- **Frontend** (repo separado): Next.js 16 (App Router) + React 19 +
  TypeScript + Tailwind CSS v4.

## Cómo levantarlo localmente

### Backend (este repo)

**Opción A — Docker (recomendado):**

```bash
docker compose up --build
# levanta Postgres (host :5433) + backend (:3000)

docker compose exec backend node dist/seed.js
# carga el catálogo real de canchas — idempotente, no duplica si ya corrió
```

**Opción B — Node directo**, con un Postgres propio ya corriendo:

```bash
npm install
npm run start:dev
npm run seed   # carga el catálogo de canchas
```

Variables de entorno requeridas (`.env`, no versionado): `DB_HOST`,
`DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, opcional `PORT` (default `3000`). Con Docker, `DB_HOST` se
fija a `db` directamente en `docker-compose.yml` — el `.env` con `DB_HOST`
local solo aplica corriendo el backend fuera de Docker.

**Comandos útiles:**

```bash
npm run lint            # eslint --fix
npm run format           # prettier
npm test                   # unit tests (jest)
npm run test:e2e            # e2e tests
```

### Frontend (repo separado)

```bash
npm install
npm run dev   # http://localhost:3001
```

Necesita `NEXT_PUBLIC_API_URL` apuntando a este backend (si no se define,
usa `http://localhost:3000` por default).

## Features implementadas

- Autenticación con JWT (`POST /auth/login`, `GET /auth/me`); passwords
  hasheadas con bcrypt.
- Roles `client`/`admin` con autorización real aplicada en el backend
  (guards + chequeo de dueño en cada operación) — no es solo ocultar
  botones en la UI, un request directo sin permisos se rechaza igual.
- Reservas con lock de concurrencia por cancha (advisory lock de Postgres)
  para que dos requests simultáneos no dupliquen un horario, elección de
  color de petos, pago simulado, reagendado y cancelación.
- Historial de reservas propio y panel admin con vista global de reservas
  y CRUD de canchas.
- Recuperación de contraseña vía API (`/auth/forgot-password` +
  `/auth/reset-password`) — el flujo de backend está completo, todavía sin
  pantalla en el frontend (ver Roadmap).
- Rate limiting (5 intentos / 60s por IP) en `POST /auth/login` para
  mitigar fuerza bruta de contraseñas.
- Scrub de campos sensibles (password, hash de reset de contraseña) en
  toda respuesta que incluya datos de usuario.
- Validación de inputs con `class-validator` y `whitelist` +
  `forbidNonWhitelisted` global, incluyendo límites de longitud alineados
  al límite de 72 bytes de bcrypt.
- Headers de seguridad HTTP con Helmet (CSP, HSTS, `X-Frame-Options`, etc.)
  aplicados globalmente en `main.ts`.
- Diseño responsive e identidad visual propia (paleta rojo/negro,
  tipografías dedicadas para heading y cuerpo) en el frontend.

## Roadmap (mejoras no implementadas a propósito)

- Pantalla de recuperación de contraseña en el frontend (el backend ya
  soporta el flujo completo).
- Migraciones formales de base de datos (hoy `synchronize: true` de
  TypeORM).
- Tests automatizados (Jest) — unit y e2e.
- WebSockets / actualizaciones en tiempo real.
- Canchas favoritas.
- Notificaciones (email/push) — el reset de contraseña hoy devuelve el
  token directo en la respuesta en vez de enviarlo por email.
- Filtros de búsqueda de canchas (tipo, precio, horario).
- Duración mínima/máxima de reservas: `CreateReservationDto` y
  `RescheduleReservationDto` solo validan formato ISO y que
  `startTime < endTime`, sin acotar cuán corta/larga puede ser una reserva
  ni impedir fechas en el pasado.
- Pruebas Gherkin/BDD.
- Pruebas de mutación.
- Serialización centralizada de entidades con `class-transformer` — hoy el
  scrub de campos sensibles se hace a mano, campo por campo, en cada
  service que devuelve un `User`.
