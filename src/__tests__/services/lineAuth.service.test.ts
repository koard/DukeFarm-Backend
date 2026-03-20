import crypto from 'crypto';

// Mock external dependencies
jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { upsert: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../config/env', () => ({
  env: {
    jwtSecret: 'test-secret-key-for-jwt-testing',
    lineChannelId: 'test-channel-id',
    lineChannelSecret: 'test-channel-secret',
    lineRedirectUri: 'http://localhost:3000/callback',
  },
}));

jest.mock('../../utils/lineApi', () => ({
  exchangeCodeForTokens: jest.fn(),
  fetchLineProfile: jest.fn(),
}));

jest.mock('../../utils/jwt', () => ({
  signJwt: jest.fn().mockReturnValue('mock-jwt-token'),
}));

import { LineAuthService } from '../../services/lineAuth.service';
import { prisma } from '../../clients/prisma';
import { exchangeCodeForTokens, fetchLineProfile } from '../../utils/lineApi';
import { signJwt } from '../../utils/jwt';

const mockExchangeCode = exchangeCodeForTokens as jest.Mock;
const mockFetchProfile = fetchLineProfile as jest.Mock;
const mockUpsert = prisma.user.upsert as jest.Mock;

describe('LineAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLoginUrl', () => {
    it('should generate a valid LINE login URL', () => {
      const result = LineAuthService.createLoginUrl();

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('state');
      expect(result.url).toContain('https://access.line.me/oauth2/v2.1/authorize');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('client_id=test-channel-id');
      expect(result.url).toContain('scope=openid+profile');
    });

    it('should include state parameter in URL', () => {
      const result = LineAuthService.createLoginUrl();

      expect(result.state).toBeDefined();
      expect(typeof result.state).toBe('string');
      expect(result.state.length).toBe(32); // 16 bytes hex = 32 chars
      expect(result.url).toContain(`state=${result.state}`);
    });

    it('should generate unique states on each call', () => {
      const result1 = LineAuthService.createLoginUrl();
      const result2 = LineAuthService.createLoginUrl();

      expect(result1.state).not.toBe(result2.state);
    });

    it('should accept optional role parameter', () => {
      const result = LineAuthService.createLoginUrl('FARMER' as any);

      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();
    });
  });

  describe('handleCallback', () => {
    const mockProfile = {
      userId: 'line-user-id-123',
      displayName: 'Test LINE User',
      pictureUrl: 'https://example.com/pic.jpg',
    };

    const mockUser = {
      id: 'uuid-123',
      displayName: 'Test LINE User',
      pictureUrl: 'https://example.com/pic.jpg',
      role: 'FARMER' as const,
      registrationStatus: 'PENDING' as const,
    };

    beforeEach(() => {
      mockExchangeCode.mockResolvedValue({ access_token: 'mock-access-token' });
      mockFetchProfile.mockResolvedValue(mockProfile);
      mockUpsert.mockResolvedValue(mockUser);
    });

    it('should exchange code, fetch profile, and return token', async () => {
      // Create a login URL first to get valid state
      const { state } = LineAuthService.createLoginUrl();

      const result = await LineAuthService.handleCallback('auth-code', state);

      expect(mockExchangeCode).toHaveBeenCalledWith('auth-code');
      expect(mockFetchProfile).toHaveBeenCalledWith('mock-access-token');
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.displayName).toBe('Test LINE User');
    });

    it('should upsert user in database', async () => {
      const { state } = LineAuthService.createLoginUrl();

      await LineAuthService.handleCallback('code', state);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { lineUserId: 'line-user-id-123' },
          update: expect.objectContaining({
            displayName: 'Test LINE User',
          }),
          create: expect.objectContaining({
            lineUserId: 'line-user-id-123',
            loginProvider: 'LINE',
          }),
        }),
      );
    });

    it('should throw on missing state', async () => {
      await expect(LineAuthService.handleCallback('code', undefined))
        .rejects.toThrow('Missing state');
    });

    it('should throw on invalid state', async () => {
      await expect(LineAuthService.handleCallback('code', 'invalid-state'))
        .rejects.toThrow('Invalid or expired state');
    });

    it('should throw when state is reused (already consumed)', async () => {
      const { state } = LineAuthService.createLoginUrl();

      // First call should succeed
      await LineAuthService.handleCallback('code', state);

      // Second call with same state should fail
      await expect(LineAuthService.handleCallback('code', state))
        .rejects.toThrow('Invalid or expired state');
    });

    it('should call signJwt with correct payload', async () => {
      const { state } = LineAuthService.createLoginUrl();

      await LineAuthService.handleCallback('code', state);

      expect(signJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'uuid-123',
          provider: 'LINE',
          displayName: 'Test LINE User',
          role: 'FARMER',
          registrationStatus: 'PENDING',
        }),
      );
    });
  });
});
