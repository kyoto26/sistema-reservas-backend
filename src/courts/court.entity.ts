import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  sportType!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerHour!: number;

  @OneToMany(() => Reservation, (reservation) => reservation.court)
  reservations!: Reservation[];
}