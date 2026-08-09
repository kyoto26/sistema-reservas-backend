import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { FindCourtsQueryDto } from './dto/find-courts-query.dto';
import { Reservation } from '../reservations/reservation.entity';
import { applyOverlapConditions } from '../reservations/reservation-overlap';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private courtsRepository: Repository<Court>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
  ) {}

  create(createCourtDto: CreateCourtDto): Promise<Court> {
    const newCourt = this.courtsRepository.create(createCourtDto);
    return this.courtsRepository.save(newCourt);
  }

  async findAll(query?: FindCourtsQueryDto): Promise<Court[]> {
    const { startTime: startTimeRaw, endTime: endTimeRaw } = query ?? {};

    if (!startTimeRaw && !endTimeRaw) {
      return this.courtsRepository.find();
    }

    if (!startTimeRaw || !endTimeRaw) {
      throw new BadRequestException(
        'Para filtrar por disponibilidad se necesitan startTime y endTime',
      );
    }

    const startTime = new Date(startTimeRaw);
    const endTime = new Date(endTimeRaw);

    if (startTime >= endTime) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin',
      );
    }

    const blockedQuery = this.reservationsRepository
      .createQueryBuilder('reservation')
      .select('reservation.courtId', 'courtId');
    const blockedRows = await applyOverlapConditions(
      blockedQuery,
      'reservation',
      startTime,
      endTime,
    ).getRawMany<{ courtId: string }>();

    const blockedCourtIds = new Set(blockedRows.map((row) => row.courtId));

    const courts = await this.courtsRepository.find();
    return courts.filter((court) => !blockedCourtIds.has(court.id));
  }

  async findOne(id: string): Promise<Court> {
    const court = await this.courtsRepository.findOne({ where: { id } });

    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    return court;
  }

  async update(id: string, updateCourtDto: UpdateCourtDto): Promise<Court> {
    const court = await this.findOne(id);
    Object.assign(court, updateCourtDto);
    return this.courtsRepository.save(court);
  }

  async remove(id: string): Promise<void> {
    const court = await this.findOne(id);
    await this.courtsRepository.remove(court);
  }
}
