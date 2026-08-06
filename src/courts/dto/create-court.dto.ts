import { IsString, IsNumber, IsPositive } from 'class-validator';

export class CreateCourtDto {
  @IsString()
  name!: string;

  @IsString()
  sportType!: string;

  @IsNumber()
  @IsPositive()
  pricePerHour!: number;
}
