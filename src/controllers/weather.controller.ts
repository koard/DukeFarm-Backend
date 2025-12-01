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

const getHourlyForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const hours = Number(req.query.hours) || 24;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'lat and lng query params are required numbers' });
    }

    const forecast = await WeatherService.getHourlyForecast(latitude, longitude, hours);
    res.json({ data: forecast });
  } catch (error) {
    next(error);
  }
};

const getDailyForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const days = Number(req.query.days) || 7;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'lat and lng query params are required numbers' });
    }

    const forecast = await WeatherService.getDailyForecast(latitude, longitude, days);
    res.json({ data: forecast });
  } catch (error) {
    next(error);
  }
};

const getLocationInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'lat and lng query params are required numbers' });
    }

    const location = await WeatherService.getLocationName(latitude, longitude);
    res.json({ data: location });
  } catch (error) {
    next(error);
  }
};

/**
 * Get complete weather data (current + hourly + daily + location) in one call
 */
const getCompleteWeather = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'lat and lng query params are required numbers' });
    }

    const [current, hourly, daily, location] = await Promise.all([
      WeatherService.getCurrentWeather(latitude, longitude),
      WeatherService.getHourlyForecast(latitude, longitude, 24),
      WeatherService.getDailyForecast(latitude, longitude, 7),
      WeatherService.getLocationName(latitude, longitude),
    ]);

    res.json({
      data: {
        current,
        hourly,
        daily,
        location,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const WeatherController = {
  getByCoordinates,
  getHourlyForecast,
  getDailyForecast,
  getLocationInfo,
  getCompleteWeather,
};
