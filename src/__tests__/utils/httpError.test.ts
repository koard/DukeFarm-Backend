import { HttpError, createHttpError } from '../../utils/httpError';

describe('HttpError', () => {
  it('should create an error with status and message', () => {
    const error = new HttpError(404, 'Not Found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
    expect(error.details).toBeUndefined();
  });

  it('should create an error with details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new HttpError(400, 'Validation Error', details);

    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation Error');
    expect(error.details).toEqual(details);
  });

  it('should preserve prototype chain for instanceof checks', () => {
    const error = new HttpError(500, 'Internal');

    expect(error instanceof HttpError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it('should have a stack trace', () => {
    const error = new HttpError(500, 'Server Error');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('Server Error');
  });
});

describe('createHttpError', () => {
  it('should create an HttpError instance', () => {
    const error = createHttpError(403, 'Forbidden');

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Forbidden');
  });

  it('should pass details through', () => {
    const details = ['field1', 'field2'];
    const error = createHttpError(422, 'Unprocessable', details);

    expect(error.details).toEqual(details);
  });

  it('should create different status codes correctly', () => {
    const codes = [400, 401, 403, 404, 409, 500, 503];

    codes.forEach((code) => {
      const error = createHttpError(code, `Error ${code}`);
      expect(error.status).toBe(code);
    });
  });
});
