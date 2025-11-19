import { NextFunction, Request, Response } from 'express';
import { LineAuthService } from '../services/lineAuth.service';

const getLineLoginUrl = (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = LineAuthService.createLoginUrl();
    res.json({ url });
  } catch (error) {
    next(error);
  }
};

const handleLineCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error: lineError } = req.query;

    if (lineError) {
      return res.status(400).json({ message: `LINE error: ${lineError}` });
    }

    if (!code) {
      return res.status(400).json({ message: 'Missing authorization code' });
    }

    const result = await LineAuthService.handleCallback(code as string, state as string | undefined);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const LineAuthController = {
  getLineLoginUrl,
  handleLineCallback,
};
