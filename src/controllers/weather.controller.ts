import { NextFunction, Request, Response } from 'express';
import { WeatherService } from '../services/weather.service';

const getByCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'lat and lng query params are required numbers' });
    }

  const weather = await WeatherService.getCurrentWeather(latitude, longitude);
  res.json({ data: weather });
  } catch (error) {
    next(error);
  }
};

export const WeatherController = {
  getByCoordinates,
};
