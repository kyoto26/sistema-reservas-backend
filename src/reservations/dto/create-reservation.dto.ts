import { IsUUID, IsDateString, IsOptional, IsIn } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  courtId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsIn(['red', 'blue', 'none'])
  petosColor?: string;
}
