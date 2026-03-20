import axios from 'axios';

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../../config/env', () => ({
  env: {
    lineRedirectUri: 'http://localhost:3001/callback',
    lineChannelId: 'line-channel-id',
    lineChannelSecret: 'line-secret',
  },
}));

import { exchangeCodeForTokens, fetchLineProfile, LINE_TOKEN_ENDPOINT, LINE_PROFILE_ENDPOINT } from '../../utils/lineApi';

const mockPost = axios.post as jest.Mock;
const mockGet = axios.get as jest.Mock;

describe('lineApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exchangeCodeForTokens should call LINE token endpoint and return payload', async () => {
    mockPost.mockResolvedValue({
      data: {
        access_token: 'token',
        expires_in: 3600,
        id_token: 'id',
        scope: 'profile',
        token_type: 'Bearer',
      },
    });

    const result = await exchangeCodeForTokens('auth-code-1');

    expect(result.access_token).toBe('token');
    expect(mockPost).toHaveBeenCalledWith(
      LINE_TOKEN_ENDPOINT,
      expect.any(URLSearchParams),
      expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    );
  });

  it('fetchLineProfile should call LINE profile endpoint with bearer token', async () => {
    mockGet.mockResolvedValue({
      data: {
        userId: 'line-u1',
        displayName: 'Line User',
        pictureUrl: 'https://example.com/p.png',
      },
    });

    const result = await fetchLineProfile('abc-token');

    expect(result.userId).toBe('line-u1');
    expect(mockGet).toHaveBeenCalledWith(
      LINE_PROFILE_ENDPOINT,
      expect.objectContaining({ headers: { Authorization: 'Bearer abc-token' } }),
    );
  });
});
