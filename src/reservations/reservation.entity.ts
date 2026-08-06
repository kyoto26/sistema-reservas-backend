import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('timestamptz')
  startTime!: Date;

  @Column('timestamptz')
  endTime!: Date;

  @Column({ default: 'confirmed' })
  status!: string;

  @Column({ default: 'none' })
  petosColor!: string;

  @ManyToOne(() => User, (user) => user.reservations)
  user!: User;

  @ManyToOne(() => Court, (court) => court.reservations)
  court!: Court;
}