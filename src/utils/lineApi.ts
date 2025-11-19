import axios from 'axios';
import { env } from '../config/env';

const LINE_TOKEN_ENDPOINT = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_ENDPOINT = 'https://api.line.me/v2/profile';

type LineTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

type LineProfileResponse = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

const exchangeCodeForTokens = async (code: string): Promise<LineTokenResponse> => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.lineRedirectUri,
    client_id: env.lineChannelId,
    client_secret: env.lineChannelSecret,
  });

  const { data } = await axios.post<LineTokenResponse>(LINE_TOKEN_ENDPOINT, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return data;
};

const fetchLineProfile = async (accessToken: string): Promise<LineProfileResponse> => {
  const { data } = await axios.get<LineProfileResponse>(LINE_PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data;
};

export { exchangeCodeForTokens, fetchLineProfile, LINE_TOKEN_ENDPOINT, LINE_PROFILE_ENDPOINT };
export type { LineTokenResponse, LineProfileResponse };
