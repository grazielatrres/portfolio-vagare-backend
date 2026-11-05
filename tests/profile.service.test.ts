// profile.service.test.ts — LGPD 6.4.3 (acesso, correção e exclusão de dados do usuário)

import { AuthProvider, User } from '@prisma/client';
import { ProfileService } from '../src/services/profile.service';
import { UserRepository } from '../src/repositories/auth/user.repository';
import { TripRepository } from '../src/repositories/trip.repository';

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: 'hash',
    provider: AuthProvider.local,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ProfileService', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let tripRepository: jest.Mocked<TripRepository>;
  let profileService: ProfileService;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    tripRepository = {
      countByUser: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<TripRepository>;

    profileService = new ProfileService(userRepository, tripRepository);
  });

  describe('getProfile', () => {
    it('retorna dados do usuário com estatísticas de viagens', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      tripRepository.countByUser.mockResolvedValue(3);

      const result = await profileService.getProfile('user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        name: 'Maria Silva',
        email: 'maria@example.com',
        provider: AuthProvider.local,
        stats: { totalTrips: 3 },
      });
    });

    it('lança NotFoundError quando o usuário não existe', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(profileService.getProfile('user-1')).rejects.toMatchObject({
        name: 'NotFoundError',
        message: 'Usuário não encontrado',
      });
    });
  });

  describe('updateProfile', () => {
    it('atualiza o nome', async () => {
      userRepository.update.mockResolvedValue(buildUser({ name: 'Maria Souza' }));

      const result = await profileService.updateProfile('user-1', {
        name: 'Maria Souza',
      });

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        name: 'Maria Souza',
      });
      expect(result.name).toBe('Maria Souza');
    });

    it('lança ValidationError quando o nome é vazio', async () => {
      await expect(profileService.updateProfile('user-1', { name: '  ' })).rejects.toMatchObject({
        name: 'ValidationError',
        message: 'Nome não pode ser vazio',
      });

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('ignora o e-mail enviado no payload, pois o campo é bloqueado', async () => {
      userRepository.update.mockResolvedValue(buildUser({ name: 'Maria Souza' }));

      await profileService.updateProfile('user-1', {
        name: 'Maria Souza',
        ...({ email: 'outro@example.com' } as Record<string, unknown>),
      });

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        name: 'Maria Souza',
      });
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('exclui a conta quando o usuário existe', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await profileService.deleteAccount('user-1');

      expect(userRepository.delete).toHaveBeenCalledWith('user-1');
    });

    it('lança NotFoundError quando o usuário não existe', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(profileService.deleteAccount('user-1')).rejects.toMatchObject({
        name: 'NotFoundError',
        message: 'Usuário não encontrado',
      });

      expect(userRepository.delete).not.toHaveBeenCalled();
    });
  });
});
