import crypto from 'crypto';

describe('Password Hashing Utility', () => {
  const hashPassword = (password: string): string => {
    return crypto.createHash('sha256').update(password).digest('hex');
  };

  describe('hashPassword', () => {
    it('should hash a password', () => {
      const password = 'testPassword123';
      const hash = hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce consistent hashes for same input', () => {
      const password = 'consistentPassword';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const password1 = 'password1';
      const password2 = 'password2';
      
      const hash1 = hashPassword(password1);
      const hash2 = hashPassword(password2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const password = 'p@ssw0rd!#$%^&*()';
      const hash = hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle unicode characters', () => {
      const password = 'รหัสผ่าน123';
      const hash = hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should be case sensitive', () => {
      const hash1 = hashPassword('Password');
      const hash2 = hashPassword('password');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Known hash values', () => {
    it('should match known SHA-256 hash for "admin123"', () => {
      const password = 'admin123';
      const expectedHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
      
      const hash = hashPassword(password);
      expect(hash).toBe(expectedHash);
    });

    it('should match known SHA-256 hash for empty string', () => {
      const password = '';
      const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      
      const hash = hashPassword(password);
      expect(hash).toBe(expectedHash);
    });
  });
});
