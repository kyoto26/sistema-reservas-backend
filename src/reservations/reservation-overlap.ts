import { SelectQueryBuilder } from 'typeorm';
import { Reservation } from './reservation.entity';

/**
 * Adds to the query builder the conditions that define "overlaps with
 * [startTime, endTime)": not cancelled, and the existing range crosses the
 * new one. Used both to check for conflicts when creating/rescheduling a
 * specific reservation and to find which courts are occupied within a range.
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
