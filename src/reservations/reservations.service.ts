import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Reservation } from './reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { RescheduleReservationDto } from './dto/reschedule-reservation.dto';
import { CourtsService } from '../courts/courts.service';
import { User } from '../users/user.entity';
import { applyOverlapConditions } from './reservation-overlap';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    private dataSource: DataSource,
    private courtsService: CourtsService,
  ) {}

  async create(
    createReservationDto: CreateReservationDto,
    user: Omit<User, 'password'>,
  ): Promise<Reservation> {
    const {
      courtId,
      startTime: startTimeRaw,
      endTime: endTimeRaw,
      petosColor,
    } = createReservationDto;
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

      const overlapQuery = queryRunner.manager
        .createQueryBuilder(Reservation, 'reservation')
        .where('reservation.courtId = :courtId', { courtId });
      const overlapping = await applyOverlapConditions(
        overlapQuery,
        'reservation',
        startTime,
        endTime,
      ).getOne();

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
        petosColor: petosColor ?? 'none',
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

  findMine(userId: string): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: { user: { id: userId } },
      relations: { court: true },
    });
  }

  async findAll() {
    const reservations = await this.reservationsRepository.find({
      relations: { court: true, user: true },
    });

    return reservations.map((reservation) => {
      const {
        password,
        resetPasswordTokenHash,
        resetPasswordExpires,
        ...userWithoutPassword
      } = reservation.user;
      return { ...reservation, user: userWithoutPassword };
    });
  }

  async cancel(id: string, user: Omit<User, 'password'>) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservation.user.id !== user.id && user.role !== 'admin') {
      throw new ForbiddenException(
        'No podés cancelar una reserva que no es tuya',
      );
    }

    reservation.status = 'cancelled';
    const savedReservation = await this.reservationsRepository.save(
      reservation,
    );

    const {
      password,
      resetPasswordTokenHash,
      resetPasswordExpires,
      ...userWithoutPassword
    } = savedReservation.user;
    return { ...savedReservation, user: userWithoutPassword };
  }

  async pay(id: string, userId: string) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservation.user.id !== userId) {
      throw new ForbiddenException(
        'No podés pagar una reserva que no es tuya',
      );
    }

    if (reservation.status === 'cancelled') {
      throw new BadRequestException('No podés pagar una reserva cancelada');
    }

    if (reservation.paymentStatus === 'paid') {
      throw new ConflictException('Esta reserva ya fue pagada');
    }

    reservation.paymentStatus = 'paid';
    const savedReservation = await this.reservationsRepository.save(
      reservation,
    );

    const {
      password,
      resetPasswordTokenHash,
      resetPasswordExpires,
      ...userWithoutPassword
    } = savedReservation.user;
    return { ...savedReservation, user: userWithoutPassword };
  }

  async reschedule(
    id: string,
    rescheduleReservationDto: RescheduleReservationDto,
    userId: string,
  ) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: { user: true, court: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservation.user.id !== userId) {
      throw new ForbiddenException(
        'No podés reagendar una reserva que no es tuya',
      );
    }

    if (reservation.status === 'cancelled') {
      throw new BadRequestException(
        'No podés reagendar una reserva cancelada',
      );
    }

    const startTime = new Date(rescheduleReservationDto.startTime);
    const endTime = new Date(rescheduleReservationDto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin',
      );
    }

    const courtId = reservation.court.id;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
        [courtId],
      );

      const overlapQuery = queryRunner.manager
        .createQueryBuilder(Reservation, 'reservation')
        .where('reservation.courtId = :courtId', { courtId })
        .andWhere('reservation.id != :id', { id });
      const overlapping = await applyOverlapConditions(
        overlapQuery,
        'reservation',
        startTime,
        endTime,
      ).getOne();

      if (overlapping) {
        throw new ConflictException(
          'Ya existe una reserva para esa cancha en ese horario',
        );
      }

      await queryRunner.manager.update(Reservation, id, {
        startTime,
        endTime,
      });

      await queryRunner.commitTransaction();

      const {
        password,
        resetPasswordTokenHash,
        resetPasswordExpires,
        ...userWithoutPassword
      } = reservation.user;
      return {
        ...reservation,
        startTime,
        endTime,
        user: userWithoutPassword,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
