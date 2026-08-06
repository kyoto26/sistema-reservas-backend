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
- **`Reservation` currently exists only as an entity** (`src/reservations/reservation.entity.ts`) with no accompanying module/service/controller yet, and is not imported into `AppModule`. It's only reachable today via TypeORM relations from `User`/`Court`. When building it out, follow the `UsersModule`/`CourtsModule` pattern (module + controller + service + DTOs) and register the new module in `AppModule`.
- **TypeORM `decimal` columns come back as strings**, not numbers, when read from the DB (e.g. `Court.pricePerHour` reads as `"50000.00"` on `GET`, but as a plain number right after `.save()`). Keep this in mind for DTOs/serialization — add a column `transformer` if consumers need a consistent numeric type.
- **Entity relations**: `User 1—N Reservation N—1 Court`. All primary keys are UUIDs (`@PrimaryGeneratedColumn('uuid')`).
- **Validation**: a global `ValidationPipe` is set up in `main.ts` with `whitelist: true, forbidNonWhitelisted: true` — incoming DTOs must declare every accepted field with `class-validator` decorators, or the request is rejected.
- **Passwords**: hashed with `bcrypt` (cost factor 10) in `UsersService.create`; the plain password is stripped from the object before it's returned (see `users.service.ts`), so services returning a `User` should follow the same `Omit<User, 'password'>` pattern.
- **User-facing error messages are written in Spanish** (e.g. `'Ya existe un usuario con ese email'`) — keep new user-facing exception messages consistent with this.
- Required env vars (see `.env`, not committed): `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, optional `PORT` (defaults to 3000).
