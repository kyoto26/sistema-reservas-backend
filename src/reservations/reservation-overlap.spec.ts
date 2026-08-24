import { SelectQueryBuilder } from 'typeorm';
import { Reservation } from './reservation.entity';
import { applyOverlapConditions } from './reservation-overlap';

interface Call {
  sql: string;
  params?: Record<string, unknown>;
}

class FakeQueryBuilder {
  calls: Call[] = [];

  where(sql: string, params?: Record<string, unknown>) {
    this.calls.push({ sql, params });
    return this;
  }

  andWhere(sql: string, params?: Record<string, unknown>) {
    this.calls.push({ sql, params });
    return this;
  }
}

function asQueryBuilder(fake: FakeQueryBuilder) {
  return fake as unknown as SelectQueryBuilder<Reservation>;
}

// Takes the params that applyOverlapConditions actually passed to andWhere
// and applies them against an existing reservation, to determine whether
// Postgres would consider it overlapping — without executing real SQL.
function wouldMatch(
  calls: Call[],
  existing: { status: string; startTime: Date; endTime: Date },
): boolean {
  const cancelledParam = calls.find((c) => c.sql.includes('!= :cancelled'))
    ?.params?.cancelled;
  const endTimeParam = calls.find((c) => c.sql.includes('< :endTime'))?.params
    ?.endTime as Date;
  const startTimeParam = calls.find((c) => c.sql.includes('> :startTime'))
    ?.params?.startTime as Date;

  return (
    existing.status !== cancelledParam &&
    existing.startTime < endTimeParam &&
    existing.endTime > startTimeParam
  );
}

describe('applyOverlapConditions', () => {
  const alias = 'reservation';

  it('agrega exactamente las 3 condiciones, con el alias y los params correctos', () => {
    const fake = new FakeQueryBuilder();
    const startTime = new Date('2026-09-01T10:00:00.000Z');
    const endTime = new Date('2026-09-01T11:00:00.000Z');

    applyOverlapConditions(asQueryBuilder(fake), alias, startTime, endTime);

    expect(fake.calls).toEqual([
      {
        sql: `${alias}.status != :cancelled`,
        params: { cancelled: 'cancelled' },
      },
      { sql: `${alias}.startTime < :endTime`, params: { endTime } },
      { sql: `${alias}.endTime > :startTime`, params: { startTime } },
    ]);
  });

  const existingReservation = {
    status: 'confirmed',
    startTime: new Date('2026-09-01T10:00:00.000Z'),
    endTime: new Date('2026-09-01T11:00:00.000Z'),
  };

  it.each([
    [
      'solapamiento total (mismo rango exacto)',
      new Date('2026-09-01T10:00:00.000Z'),
      new Date('2026-09-01T11:00:00.000Z'),
      true,
    ],
    [
      'solapamiento parcial al inicio (la nueva termina dentro de la existente)',
      new Date('2026-09-01T09:30:00.000Z'),
      new Date('2026-09-01T10:30:00.000Z'),
      true,
    ],
    [
      'solapamiento parcial al final (la nueva empieza dentro de la existente)',
      new Date('2026-09-01T10:30:00.000Z'),
      new Date('2026-09-01T11:30:00.000Z'),
      true,
    ],
    [
      'sin solapamiento, back-to-back justo después (boundary: no debe contar)',
      new Date('2026-09-01T11:00:00.000Z'),
      new Date('2026-09-01T12:00:00.000Z'),
      false,
    ],
    [
      'sin solapamiento, back-to-back justo antes (boundary: no debe contar)',
      new Date('2026-09-01T09:00:00.000Z'),
      new Date('2026-09-01T10:00:00.000Z'),
      false,
    ],
    [
      'sin solapamiento, completamente separada',
      new Date('2026-09-01T14:00:00.000Z'),
      new Date('2026-09-01T15:00:00.000Z'),
      false,
    ],
  ])('%s', (_desc, startTime, endTime, expected) => {
    const fake = new FakeQueryBuilder();
    applyOverlapConditions(asQueryBuilder(fake), alias, startTime, endTime);

    expect(wouldMatch(fake.calls, existingReservation)).toBe(expected);
  });

  it('una reserva cancelada no cuenta como solapamiento aunque el horario coincida', () => {
    const fake = new FakeQueryBuilder();
    const startTime = new Date('2026-09-01T10:00:00.000Z');
    const endTime = new Date('2026-09-01T11:00:00.000Z');

    applyOverlapConditions(asQueryBuilder(fake), alias, startTime, endTime);

    expect(
      wouldMatch(fake.calls, { ...existingReservation, status: 'cancelled' }),
    ).toBe(false);
  });

  it('compone bien con el excludeId que agrega el service en reschedule', () => {
    const fake = new FakeQueryBuilder();
    const ownId = 'reservation-id-being-rescheduled';
    const startTime = new Date('2026-09-01T10:00:00.000Z');
    const endTime = new Date('2026-09-01T11:00:00.000Z');

    fake
      .where(`${alias}.courtId = :courtId`, { courtId: 'court-1' })
      .andWhere(`${alias}.id != :id`, { id: ownId });
    applyOverlapConditions(asQueryBuilder(fake), alias, startTime, endTime);

    expect(fake.calls).toEqual([
      { sql: `${alias}.courtId = :courtId`, params: { courtId: 'court-1' } },
      { sql: `${alias}.id != :id`, params: { id: ownId } },
      {
        sql: `${alias}.status != :cancelled`,
        params: { cancelled: 'cancelled' },
      },
      { sql: `${alias}.startTime < :endTime`, params: { endTime } },
      { sql: `${alias}.endTime > :startTime`, params: { startTime } },
    ]);
  });
});
