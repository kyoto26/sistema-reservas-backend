import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    usersService = { findById: jest.fn() };

    strategy = new JwtStrategy(
      configService,
      usersService as unknown as UsersService,
    );
  });

  const payload = { sub: 'user-id', email: 'user@example.com', role: 'client' };

  it('rechaza el token cuando el usuario ya no existe en la DB', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('devuelve el usuario sin el password cuando el token es válido', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-id',
      name: 'Test User',
      email: 'user@example.com',
      password: 'hashed-password',
      role: 'client',
      resetPasswordTokenHash: null,
      resetPasswordExpires: null,
    });

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: 'user-id',
      name: 'Test User',
      email: 'user@example.com',
      role: 'client',
    });
    expect(result).not.toHaveProperty('password');
  });
});
