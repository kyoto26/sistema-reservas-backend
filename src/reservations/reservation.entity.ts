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

  @Column('timestamp')
  startTime!: Date;

  @Column('timestamp')
  endTime!: Date;

  @Column({ default: 'confirmed' })
  status!: string;

  @ManyToOne(() => User, (user) => user.reservations)
  user!: User;

  @ManyToOne(() => Court, (court) => court.reservations)
  court!: Court;
}