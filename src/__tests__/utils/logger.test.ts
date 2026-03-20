import { logger } from '../../utils/logger';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log info via console.log', () => {
      logger.info('info message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('info message');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should log debug via console.log', () => {
      logger.debug('debug message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.level).toBe('debug');
      expect(parsed.message).toBe('debug message');
    });

    it('should log warn via console.warn', () => {
      logger.warn('warn message');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(parsed.level).toBe('warn');
      expect(parsed.message).toBe('warn message');
    });

    it('should log error via console.error', () => {
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('error message');
    });
  });

  describe('metadata serialization', () => {
    it('should include metadata in the output', () => {
      logger.info('with meta', { userId: '123', action: 'login' });

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('login');
    });

    it('should serialize Error objects', () => {
      const error = new Error('something broke');
      logger.error('error occurred', { error });

      const parsed = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(parsed.error).toHaveProperty('name', 'Error');
      expect(parsed.error).toHaveProperty('message', 'something broke');
      expect(parsed.error).toHaveProperty('stack');
    });

    it('should serialize nested objects', () => {
      logger.info('nested', { outer: { inner: { deep: 'value' } } });

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.outer.inner.deep).toBe('value');
    });

    it('should serialize arrays', () => {
      logger.info('with array', { items: [1, 2, 3] });

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.items).toEqual([1, 2, 3]);
    });

    it('should handle log without metadata', () => {
      logger.info('no meta');

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('no meta');
    });

    it('should include ISO timestamp', () => {
      logger.info('timestamp test');

      const parsed = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(() => new Date(parsed.timestamp)).not.toThrow();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
  });
});
