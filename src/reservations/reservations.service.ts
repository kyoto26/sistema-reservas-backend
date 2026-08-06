import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Reservation } from './reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CourtsService } from '../courts/courts.service';
import { User } from '../users/user.entity';

@Injectable()
export class ReservationsService {
  constructor(
    private dataSource: DataSource,
    private courtsService: CourtsService,
  ) {}

  async create(
    createReservationDto: CreateReservationDto,
    user: Omit<User, 'password'>,
  ): Promise<Reservation> {
    const { courtId, startTime: startTimeRaw, endTime: endTimeRaw } =
      createReservationDto;
    const startTime = new Date(startTimeRaw);
    const endTime = new Date(endTimeRaw);

    if (startTime >= endTime) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin',
      );
    }

    await this.courtsService.findOne(courtId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Serializa la creación de reservas por cancha: dos requests concurrentes
      // para la misma courtId esperan su turno acá antes de chequear solapamiento.
      await queryRunner.query(
        'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
        [courtId],
      );

      const overlapping = await queryRunner.manager
        .createQueryBuilder(Reservation, 'reservation')
        .where('reservation.courtId = :courtId', { courtId })
        .andWhere('reservation.status != :cancelled', {
          cancelled: 'cancelled',
        })
        .andWhere('reservation.startTime < :endTime', { endTime })
        .andWhere('reservation.endTime > :startTime', { startTime })
        .getOne();

      if (overlapping) {
        throw new ConflictException(
          'Ya existe una reserva para esa cancha en ese horario',
        );
      }

      const reservation = queryRunner.manager.create(Reservation, {
        startTime,
        endTime,
        court: { id: courtId },
        user,
      });

      const savedReservation = await queryRunner.manager.save(reservation);
      await queryRunner.commitTransaction();

      return savedReservation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
