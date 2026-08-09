import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';
import { Court } from './court.entity';
import { Reservation } from '../reservations/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Court, Reservation])],
  controllers: [CourtsController],
  providers: [CourtsService],
  exports: [CourtsService],
})
export class CourtsModule {}
