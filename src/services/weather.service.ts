import axios from 'axios';
import { env } from '../config/env';

const GOOGLE_WEATHER_BASE_URL = 'https://weather.googleapis.com/v1/currentConditions:lookup';

type Measurement = {
  value?: number | string;
  unit?: string;
};

type CurrentConditionsPayload = {
  observationTime?: string;
  timestamp?: string;
  temperature?: Measurement;
  humidity?: Measurement;
  windSpeed?: Measurement;
  precipitationLastHour?: Measurement;
  weatherCode?: string;
  weatherText?: string;
  conditionDescription?: string;
};

type CurrentWeatherApiResponse = {
  currentConditions?: CurrentConditionsPayload;
};

export type CurrentWeather = {
  time: string;
  temperatureC: number;
  humidityPct?: number;
  windSpeedKph?: number;
  rainMm?: number;
  conditionText?: string;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toCelsius = (measurement?: Measurement): number | undefined => {
  const value = coerceNumber(measurement?.value);
  if (value === undefined) {
    return undefined;
  }

  switch (measurement?.unit) {
    case 'FAHRENHEIT':
    case 'Fahrenheit':
      return ((value - 32) * 5) / 9;
    case 'KELVIN':
    case 'Kelvin':
      return value - 273.15;
    default:
      return value;
  }
};

const toKph = (measurement?: Measurement): number | undefined => {
  const value = coerceNumber(measurement?.value);
  if (value === undefined) {
    return undefined;
  }

  switch (measurement?.unit) {
    case 'METERS_PER_SECOND':
    case 'm/s':
      return value * 3.6;
    case 'MILES_PER_HOUR':
    case 'mph':
      return value * 1.60934;
    default:
      return value;
  }
};

const toMillimeters = (measurement?: Measurement): number | undefined => {
  const value = coerceNumber(measurement?.value);
  if (value === undefined) {
    return undefined;
  }

  switch (measurement?.unit) {
    case 'INCHES':
    case 'in':
      return value * 25.4;
    default:
      return value;
  }
};

const mapCurrentConditions = (conditions: CurrentConditionsPayload): CurrentWeather => {
  const temperatureC = toCelsius(conditions.temperature);

  if (temperatureC === undefined) {
    throw new Error('Weather API returned no temperature reading');
  }

  const payload: CurrentWeather = {
    time: conditions.observationTime ?? conditions.timestamp ?? new Date().toISOString(),
    temperatureC,
  };

  const humidity = coerceNumber(conditions.humidity?.value);
  if (humidity !== undefined) {
    payload.humidityPct = humidity;
  }

  const wind = toKph(conditions.windSpeed);
  if (wind !== undefined) {
    payload.windSpeedKph = wind;
  }

  const rain = toMillimeters(conditions.precipitationLastHour);
  if (rain !== undefined) {
    payload.rainMm = rain;
  }

  const conditionText =
    conditions.weatherText ?? conditions.conditionDescription ?? conditions.weatherCode;
  if (conditionText) {
    payload.conditionText = conditionText;
  }

  return payload;
};

const getCurrentWeather = async (lat: number, lng: number): Promise<CurrentWeather> => {
  try {
    const response = await axios.get<CurrentWeatherApiResponse>(GOOGLE_WEATHER_BASE_URL, {
      params: {
        key: env.googleWeatherApiKey,
        'location.latitude': lat,
        'location.longitude': lng,
      },
    });

    const conditions = response.data.currentConditions;
    if (!conditions) {
      throw new Error('Weather API returned no current conditions');
    }

    return mapCurrentConditions(conditions);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'network';
      const message =
        typeof error.response?.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response?.data ?? {});

      throw new Error(`Weather API error (${status}): ${message || error.message}`);
    }

    throw error;
  }
};

export const WeatherService = {
  getCurrentWeather,
};
