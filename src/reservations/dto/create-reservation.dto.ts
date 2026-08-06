import { IsUUID, IsDateString } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  courtId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}
