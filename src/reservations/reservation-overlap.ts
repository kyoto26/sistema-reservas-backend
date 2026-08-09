import { SelectQueryBuilder } from 'typeorm';
import { Reservation } from './reservation.entity';

/**
 * Agrega al query builder las condiciones que definen "se solapa con
 * [startTime, endTime)": no cancelada, y el rango existente cruza el nuevo.
 * Se usa tanto para chequear conflictos al crear/reagendar una reserva
 * puntual como para encontrar qué canchas están ocupadas en un rango.
 */
export function applyOverlapConditions(
  qb: SelectQueryBuilder<Reservation>,
  alias: string,
  startTime: Date,
  endTime: Date,
): SelectQueryBuilder<Reservation> {
  return qb
    .andWhere(`${alias}.status != :cancelled`, { cancelled: 'cancelled' })
    .andWhere(`${alias}.startTime < :endTime`, { endTime })
    .andWhere(`${alias}.endTime > :startTime`, { startTime });
}
