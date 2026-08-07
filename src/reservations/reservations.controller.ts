import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { RescheduleReservationDto } from './dto/reschedule-reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.reservationsService.create(createReservationDto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('all')
  findAll() {
    return this.reservationsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findMine(@CurrentUser() user: Omit<User, 'password'>) {
    return this.reservationsService.findMine(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: Omit<User, 'password'>) {
    return this.reservationsService.cancel(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/pay')
  pay(@Param('id') id: string, @CurrentUser() user: Omit<User, 'password'>) {
    return this.reservationsService.pay(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleReservationDto: RescheduleReservationDto,
    @CurrentUser() user: Omit<User, 'password'>,
  ) {
    return this.reservationsService.reschedule(
      id,
      rescheduleReservationDto,
      user.id,
    );
  }
}
