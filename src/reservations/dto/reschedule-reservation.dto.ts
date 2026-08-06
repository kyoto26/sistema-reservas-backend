import { IsDateString } from 'class-validator';

export class RescheduleReservationDto {
  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}
