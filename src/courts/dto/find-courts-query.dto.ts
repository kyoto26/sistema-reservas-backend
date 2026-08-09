import { IsDateString, IsOptional } from 'class-validator';

export class FindCourtsQueryDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}
