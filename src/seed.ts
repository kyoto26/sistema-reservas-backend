import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CourtsService } from './courts/courts.service';

const COURTS = [
  { name: 'Cancha Fútbol 5 - A', sportType: 'futbol5', pricePerHour: 60000 },
  { name: 'Cancha Fútbol 5 - B', sportType: 'futbol5', pricePerHour: 60000 },
  { name: 'Cancha Fútbol 6 - A', sportType: 'futbol6', pricePerHour: 70000 },
  { name: 'Cancha Fútbol 6 - B', sportType: 'futbol6', pricePerHour: 70000 },
  { name: 'Cancha Fútbol 8', sportType: 'futbol8', pricePerHour: 90000 },
  { name: 'Cancha Fútbol 11', sportType: 'futbol11', pricePerHour: 140000 },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const courtsService = app.get(CourtsService);

  const existingCourts = await courtsService.findAll();
  const existingNames = new Set(existingCourts.map((court) => court.name));

  for (const court of COURTS) {
    if (existingNames.has(court.name)) {
      console.log(`Ya existe, se omite: ${court.name}`);
      continue;
    }

    await courtsService.create(court);
    console.log(`Creada: ${court.name}`);
  }

  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
