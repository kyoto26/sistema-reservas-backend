import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // API pura consumida desde otro origen (CORS_ORIGIN) — el default
      // 'same-origin' de Helmet bloquea esas respuestas pese a que CORS las permite.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({ origin: corsOrigins });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
