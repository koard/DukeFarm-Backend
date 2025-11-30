import { signJwt, verifyJwt, DukeFarmJwtPayload } from '../../utils/jwt';
import { env } from '../../config/env';

describe('JWT Utils', () => {
  const mockPayload: DukeFarmJwtPayload = {
    sub: 'test-user-id',
    provider: 'LOCAL',
    displayName: 'Test User',
    role: 'FARMER',
    registrationStatus: 'APPROVED',
  };

  describe('signJwt', () => {
    it('should sign a JWT token with valid payload', () => {
      const token = signJwt(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should create token with LINE provider', () => {
      const linePayload: DukeFarmJwtPayload = {
        sub: 'line-user-id',
        provider: 'LINE',
        displayName: 'LINE User',
        pictureUrl: 'https://example.com/pic.jpg',
      };
      const token = signJwt(linePayload);
      expect(token).toBeDefined();
    });

    it('should accept custom options', () => {
      const token = signJwt(mockPayload, { expiresIn: '1h' });
      expect(token).toBeDefined();
      const decoded = verifyJwt(token);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyJwt', () => {
    it('should verify and decode a valid token', () => {
      const token = signJwt(mockPayload);
      const decoded = verifyJwt<DukeFarmJwtPayload>(token);
      
      expect(decoded.sub).toBe(mockPayload.sub);
      expect(decoded.provider).toBe(mockPayload.provider);
      expect(decoded.displayName).toBe(mockPayload.displayName);
      expect(decoded.role).toBe(mockPayload.role);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyJwt('invalid-token')).toThrow();
    });

    it('should throw error for tampered token', () => {
      const token = signJwt(mockPayload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyJwt(tamperedToken)).toThrow();
    });

    it('should decode token without expiration', () => {
      const token = signJwt(mockPayload);
      const decoded = verifyJwt(token);
      expect(decoded.exp).toBeUndefined();
    });
  });

  describe('Token roundtrip', () => {
    it('should preserve all payload fields', () => {
      const fullPayload: DukeFarmJwtPayload = {
        sub: 'user-123',
        provider: 'LINE',
        displayName: 'Full Name',
        pictureUrl: 'https://example.com/avatar.png',
        role: 'RESEARCHER',
        registrationStatus: 'PENDING',
      };

      const token = signJwt(fullPayload);
      const decoded = verifyJwt<DukeFarmJwtPayload>(token);

      expect(decoded.sub).toBe(fullPayload.sub);
      expect(decoded.provider).toBe(fullPayload.provider);
      expect(decoded.displayName).toBe(fullPayload.displayName);
      expect(decoded.pictureUrl).toBe(fullPayload.pictureUrl);
      expect(decoded.role).toBe(fullPayload.role);
      expect(decoded.registrationStatus).toBe(fullPayload.registrationStatus);
    });
  });
});
