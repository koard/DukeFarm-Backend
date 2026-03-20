import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { signJwt, DukeFarmJwtPayload } from '../../utils/jwt';

describe('authMiddleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = { headers: {} };
    mockRes = { status: statusMock, json: jsonMock } as any;
    mockNext = jest.fn();
  });

  it('should return 401 when authorization header is missing', () => {
    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Missing or invalid authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    mockReq.headers = { authorization: 'Basic some-token' };

    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Missing or invalid authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    mockReq.headers = { authorization: 'Bearer invalid.token.here' };

    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should populate req.user and call next() for a valid token', () => {
    const payload: DukeFarmJwtPayload = {
      sub: 'user-123',
      provider: 'LOCAL',
      displayName: 'Test User',
      role: 'FARMER',
      registrationStatus: 'APPROVED',
    };
    const token = signJwt(payload);
    mockReq.headers = { authorization: `Bearer ${token}` };

    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user!.id).toBe('user-123');
    expect(mockReq.user!.provider).toBe('LOCAL');
    expect(mockReq.user!.displayName).toBe('Test User');
    expect(mockReq.user!.role).toBe('FARMER');
  });

  it('should populate req.user with LINE provider fields', () => {
    const payload: DukeFarmJwtPayload = {
      sub: 'line-user-456',
      provider: 'LINE',
      displayName: 'LINE User',
      pictureUrl: 'https://example.com/pic.jpg',
    };
    const token = signJwt(payload);
    mockReq.headers = { authorization: `Bearer ${token}` };

    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user!.id).toBe('line-user-456');
    expect(mockReq.user!.provider).toBe('LINE');
    expect(mockReq.user!.pictureUrl).toBe('https://example.com/pic.jpg');
  });

  it('should return 401 for a tampered token', () => {
    const payload: DukeFarmJwtPayload = {
      sub: 'user-789',
      provider: 'LOCAL',
    };
    const token = signJwt(payload);
    const tampered = token.slice(0, -5) + 'xxxxx';
    mockReq.headers = { authorization: `Bearer ${tampered}` };

    authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
