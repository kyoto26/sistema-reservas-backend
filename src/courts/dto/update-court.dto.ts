import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class UpdateCourtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sportType?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerHour?: number;
}
