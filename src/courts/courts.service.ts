import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private courtsRepository: Repository<Court>,
  ) {}

  create(createCourtDto: CreateCourtDto): Promise<Court> {
    const newCourt = this.courtsRepository.create(createCourtDto);
    return this.courtsRepository.save(newCourt);
  }

  findAll(): Promise<Court[]> {
    return this.courtsRepository.find();
  }

  async findOne(id: string): Promise<Court> {
    const court = await this.courtsRepository.findOne({ where: { id } });

    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    return court;
  }
}
