import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('deniega el acceso a un usuario client en una ruta que requiere admin', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext({ role: 'client' });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('permite el acceso a un usuario admin en una ruta que requiere admin', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext({ role: 'admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el acceso a cualquier usuario autenticado en una ruta sin @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ role: 'client' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
