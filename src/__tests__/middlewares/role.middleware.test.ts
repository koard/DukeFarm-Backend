import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

// Mock prisma
jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockFindUnique = prisma.user.findUnique as jest.Mock;

describe('roleMiddleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
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
    jest.clearAllMocks();
  });

  it('should return 401 when req.user is not set', async () => {
    const middleware = roleMiddleware(['ADMIN']);

    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 404 when user is not found in database', async () => {
    mockReq.user = { id: 'nonexistent-id', provider: 'LOCAL' };
    mockFindUnique.mockResolvedValue(null);

    const middleware = roleMiddleware(['ADMIN']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'User not found' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when user role is not in allowed list', async () => {
    mockReq.user = { id: 'user-1', provider: 'LOCAL' };
    mockFindUnique.mockResolvedValue({ id: 'user-1', role: 'FARMER' });

    const middleware = roleMiddleware(['ADMIN', 'RESEARCHER']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Forbidden' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when user role is allowed', async () => {
    mockReq.user = { id: 'user-1', provider: 'LOCAL' };
    mockFindUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });

    const middleware = roleMiddleware(['ADMIN', 'RESEARCHER']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(); // called with no error
  });

  it('should update req.user.role from database', async () => {
    mockReq.user = { id: 'user-1', provider: 'LOCAL', role: 'FARMER' };
    mockFindUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });

    const middleware = roleMiddleware(['ADMIN']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockReq.user!.role).toBe('ADMIN');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next(error) on database error', async () => {
    mockReq.user = { id: 'user-1', provider: 'LOCAL' };
    const dbError = new Error('DB connection lost');
    mockFindUnique.mockRejectedValue(dbError);

    const middleware = roleMiddleware(['ADMIN']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(dbError);
  });

  it('should work with multiple allowed roles', async () => {
    mockReq.user = { id: 'user-1', provider: 'LINE' };
    mockFindUnique.mockResolvedValue({ id: 'user-1', role: 'RESEARCHER' });

    const middleware = roleMiddleware(['FARMER', 'RESEARCHER', 'ADMIN']);
    await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
