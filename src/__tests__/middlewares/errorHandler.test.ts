import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middlewares/errorHandler';

// Suppress logger output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {};
    mockRes = { status: statusMock, json: jsonMock } as any;
    mockNext = jest.fn();
  });

  it('should use error.status when provided', () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Not Found' });
  });

  it('should default to 500 when error has no status', () => {
    const error = new Error('Something went wrong');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Something went wrong' });
  });

  it('should include details when present on error', () => {
    const error = Object.assign(new Error('Validation failed'), {
      status: 422,
      details: { field: 'email', issue: 'invalid' },
    });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(422);
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Validation failed',
      details: { field: 'email', issue: 'invalid' },
    });
  });

  it('should not include details when not present', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(jsonMock).toHaveBeenCalledWith({ message: 'Forbidden' });
    const body = jsonMock.mock.calls[0][0];
    expect(body).not.toHaveProperty('details');
  });

  it('should use "Internal server error" when message is empty', () => {
    const error = Object.assign(new Error(''), { status: 500 });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(jsonMock).toHaveBeenCalledWith({ message: 'Internal server error' });
  });
});
