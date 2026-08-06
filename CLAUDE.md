# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A NestJS + TypeORM + PostgreSQL backend for a court reservation system ("sistema de reservas"). Domain: `User`, `Court`, `Reservation`.

## Commands

```bash
npm run start:dev      # run with watch mode (primary dev command)
npm run build           # nest build
npm run lint             # eslint --fix over src/apps/libs/test
npm run format            # prettier --write src/ test/

npm test                   # unit tests (jest, run from src/, matches *.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e            # e2e tests (test/*.e2e-spec.ts, separate jest config)

# Run a single unit test file
npx jest users.service.spec.ts

# Run a single e2e test file
npx jest --config ./test/jest-e2e.json app.e2e-spec.ts
```

Unit test config lives inline in `package.json` (`jest` key) with `rootDir: "src"` — spec files must sit next to the code they test as `*.spec.ts`. E2E tests use the separate `test/jest-e2e.json` config with `rootDir: "."` and match `*.e2e-spec.ts`.

## Architecture

- **Module wiring**: `AppModule` (`src/app.module.ts`) loads `ConfigModule` (global, reads `.env`) and `TypeOrmModule.forRootAsync` (Postgres, driven entirely by env vars, `synchronize: true`). TypeORM entities are picked up automatically via the glob `__dirname + '/**/*.entity{.ts,.js}'`, **not** by explicit registration — new entities just need to be placed in a `*.entity.ts` file anywhere under `src/`.
- **Feature modules follow the standard Nest layout**: `<feature>/<feature>.module.ts` wires `TypeOrmModule.forFeature([Entity])` + controller + service; DTOs live in `<feature>/dto/`. `UsersModule` and `CourtsModule` (`src/users/`, `src/courts/`) are registered in `AppModule`. `CourtsModule` exports `CourtsService` so other modules (e.g. Reservations) can inject it to validate a court exists.
- **Reservations** (`src/reservations/`): `POST /reservations` is protected with `@UseGuards(JwtAuthGuard)` only (no `@Roles`, any authenticated user can book) and associates the reservation to `@CurrentUser()` — the DTO has no `userId` field, and `whitelist`/`forbidNonWhitelisted` on the global `ValidationPipe` reject one if sent, so a client can never book on someone else's behalf.
  - **Overlap check**: two reservations on the same `courtId` conflict iff `existing.startTime < new.endTime AND existing.endTime > new.startTime` (excluding `status = 'cancelled'`). This alone has a check-then-act race under concurrent requests, so `ReservationsService.create` wraps the overlap check + insert in a DB transaction (`DataSource.createQueryRunner()`) and takes a Postgres advisory lock scoped to the court (`pg_advisory_xact_lock(hashtext(courtId)::bigint)`) before checking — this serializes concurrent booking attempts for the *same* court while leaving other courts unaffected. Follow this same pattern for any other "no double-booking" style invariant.
  - **Parse date/time DTO fields to `Date` once, then reuse that value everywhere** (both the overlap query params and the entity being saved). Passing the raw ISO string to one and a `Date` to the other hit a real bug here: TypeORM's save path and a raw `QueryBuilder.andWhere()` string param serialize timestamps differently, so the two ends of the same comparison silently used different absolute times and overlap detection didn't fire.
  - **`startTime`/`endTime` are `timestamptz`, not `timestamp`.** A `timestamp` (no timezone) column combined with `pg`'s local-time serialization of JS `Date` params caused stored values to silently drift by the server's UTC offset (caught this at UTC-5/`America/Bogota`) — relative ordering stayed correct but absolute times were wrong, and it would have broken differently on a server in another timezone. Keep any new date/time column `timestamptz`. If one ever needs converting after the fact, `synchronize: true`'s automatic column-type change can fail mid-way (hit a `NOT NULL` error here) — it rolls back cleanly (no data loss), but the fix is a manual `ALTER TABLE ... ALTER COLUMN x TYPE timestamptz USING x AT TIME ZONE '<server tz>'`, not the default synchronize path.
  - `GET /reservations` returns only the caller's own reservations (filtered by `@CurrentUser().id` server-side, not a query param). `GET /reservations/all` is `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` and returns every reservation across all users, with `court` and `user` relations loaded — same password-scrub as `cancel()` below, applied per-row before the array is returned. Declared before the plain `GET /reservations` route in the controller so `/all` isn't ever swallowed by a param route. `PATCH /reservations/:id/cancel` sets `status: 'cancelled'` (never deletes the row — the overlap check already excludes cancelled reservations, so cancelling immediately frees the slot) and checks `reservation.user.id === currentUser.id` before allowing it, throwing `ForbiddenException` otherwise — ownership, not role, gates this.
  - **Never return an entity relation fetched via `relations: { user: true }` directly** — it carries the full `User` row, password hash included. `cancel()` hit exactly this (leaked the bcrypt hash in the response) until fixed to destructure `password` out of `reservation.user` before returning, same as the `Omit<User, 'password'>` pattern used elsewhere. Any query that loads `user` (or any relation containing credentials) needs this same scrub before it reaches a response.
  - This TypeORM version's `relations` option takes an object (`relations: { court: true }`), not the older array form (`relations: ['court']`) — the array form fails to typecheck.
- **Auth** (`src/auth/`): `POST /auth/login` validates email/password against the bcrypt hash and returns a JWT (`{ sub, email, role }` payload, signed with `JWT_SECRET`/`JWT_EXPIRES_IN` from env). `JwtStrategy` verifies the token and re-fetches the user from the DB by `payload.sub` on every request (so a deleted user's token stops working immediately, not just at expiry). Protect a route with `@UseGuards(JwtAuthGuard)`, then read the authenticated user with `@CurrentUser()` (see `GET /auth/me` for the reference pattern).
- **Roles**: `@Roles('admin')` (`src/auth/roles.decorator.ts`) tags a handler/controller with allowed roles via `SetMetadata`; `RolesGuard` reads that metadata via `Reflector` and checks it against `request.user.role`. **Guard order matters**: always `@UseGuards(JwtAuthGuard, RolesGuard)` — `RolesGuard` reads `request.user`, which only `JwtAuthGuard` populates, and Nest runs guards in array order. A route with no `@Roles(...)` is open to any authenticated user; a route with neither guard is fully public (e.g. `GET /courts`, `GET /courts/:id`). There is no self-serve way to become `admin` — `role` defaults to `'client'` and isn't accepted by `CreateUserDto`, so admins are promoted directly in the DB.
- **TypeORM `decimal` columns come back as strings**, not numbers, when read from the DB (e.g. `Court.pricePerHour` reads as `"50000.00"` on `GET`, but as a plain number right after `.save()`). Keep this in mind for DTOs/serialization — add a column `transformer` if consumers need a consistent numeric type.
- **Entity relations**: `User 1—N Reservation N—1 Court`. All primary keys are UUIDs (`@PrimaryGeneratedColumn('uuid')`).
- **Validation**: a global `ValidationPipe` is set up in `main.ts` with `whitelist: true, forbidNonWhitelisted: true` — incoming DTOs must declare every accepted field with `class-validator` decorators, or the request is rejected.
- **Passwords**: hashed with `bcrypt` (cost factor 10) in `UsersService.create`; the plain password is stripped from the object before it's returned (see `users.service.ts`), so services returning a `User` should follow the same `Omit<User, 'password'>` pattern.
- **User-facing error messages are written in Spanish** (e.g. `'Ya existe un usuario con ese email'`) — keep new user-facing exception messages consistent with this.
- Required env vars (see `.env`, not committed): `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, optional `PORT` (defaults to 3000).
