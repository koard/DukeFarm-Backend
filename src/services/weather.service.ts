import axios from 'axios';
import dns from 'dns';
import https from 'https';

import { env } from '../config/env';

const GOOGLE_WEATHER_BASE_URL = 'https://weather.googleapis.com/v1/weather:forecast';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Prefer IPv4 to avoid DNS lookups that return IPv6-only addresses on hosts without IPv6 egress.
dns.setDefaultResultOrder?.('ipv4first');

const weatherClient = axios.create({
  baseURL: GOOGLE_WEATHER_BASE_URL,
  timeout: 8000,
  httpsAgent: new https.Agent({ keepAlive: true }),
});

type GoogleScalar = { value?: number | null } | null | undefined;

type GoogleCurrentConditions = {
  observationTime?: string;
  temperature?: GoogleScalar;
  apparentTemperature?: GoogleScalar;
  humidity?: number;
  relativeHumidity?: number;
  windSpeed?: GoogleScalar;
  windGust?: GoogleScalar;
  precipitationIntensity?: GoogleScalar;
  precipitationRate?: GoogleScalar;
  conditionCode?: string;
};

type GoogleHourlyForecast = {
  startTime?: string;
  temperature?: GoogleScalar;
  apparentTemperature?: GoogleScalar;
  precipitationChance?: number;
  precipitationProbability?: number;
  conditionCode?: string;
};

type GoogleDailyForecast = {
  startTime?: string;
  endTime?: string;
  conditionCode?: string;
  highTemperature?: GoogleScalar;
  highApparentTemperature?: GoogleScalar;
  lowTemperature?: GoogleScalar;
  lowApparentTemperature?: GoogleScalar;
  precipitationChance?: number;
  precipitationProbability?: number;
};

type GoogleWeatherResponse = {
  currentConditions?: GoogleCurrentConditions;
  hourlyForecasts?: { hours?: GoogleHourlyForecast[] };
  dailyForecasts?: { days?: GoogleDailyForecast[] };
};

type CacheEntry<T> = {
  timestamp: number;
  data: T;
};

const forecastCache = new Map<string, CacheEntry<GoogleWeatherResponse>>();

export type CurrentWeather = {
  time: string;
  temperatureC: number;
  humidityPct?: number;
  windSpeedKph?: number;
  rainMm?: number;
  weatherCode?: number;
  conditionText?: string;
};

export type DailyForecast = {
  date: string;
  temperatureMeanC: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  weatherCode: number;
  conditionText: string;
};

export type HourlyForecast = {
  time: string;
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
  conditionText: string;
};

export type LocationInfo = {
  name: string;
  district: string;
  city: string;
  country: string;
};

const GOOGLE_CONDITION_TO_WMO: Record<string, number> = {
  CLEAR_DAY: 0,
  CLEAR_NIGHT: 0,
  PARTLY_CLOUDY_DAY: 2,
  PARTLY_CLOUDY_NIGHT: 2,
  MOSTLY_CLOUDY_DAY: 3,
  MOSTLY_CLOUDY_NIGHT: 3,
  CLOUDY: 3,
  FOG: 45,
  HAZE: 45,
  LIGHT_FOG: 45,
  DRIZZLE: 51,
  LIGHT_RAIN: 61,
  RAIN: 63,
  HEAVY_RAIN: 65,
  THUNDERSTORM: 95,
  THUNDERSTORM_WITH_HAIL: 96,
  SNOW: 75,
  LIGHT_SNOW: 71,
  HEAVY_SNOW: 75,
};

const formatConditionText = (conditionCode?: string): string => {
  if (!conditionCode) return 'Unknown';
  return conditionCode
    .toLowerCase()
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const mapGoogleConditionToWMO = (conditionCode?: string): number => {
  if (!conditionCode) return 0;
  return GOOGLE_CONDITION_TO_WMO[conditionCode] ?? 0;
};

const scalarToNumber = (value?: GoogleScalar): number | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const numeric = value.value;
  return typeof numeric === 'number' ? numeric : undefined;
};

const normalizeHumidity = (value?: number): number | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
};

const normalizeProbability = (value?: number): number => {
  if (typeof value !== 'number') return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
};

const buildCacheKey = (lat: number, lng: number): string => `${lat.toFixed(3)},${lng.toFixed(3)}`;

const getCachedForecast = (key: string): GoogleWeatherResponse | null => {
  const entry = forecastCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    forecastCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCache = (key: string, data: GoogleWeatherResponse): void => {
  forecastCache.set(key, { timestamp: Date.now(), data });
};

const handleAxiosError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'network';
    const code = error.code ?? 'unknown';
    const payload =
      typeof error.response?.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response?.data ?? {});

    throw new Error(`Weather API error (${status}/${code}): ${payload || error.message}`);
  }

  throw error;
};

const fetchForecast = async (lat: number, lng: number): Promise<GoogleWeatherResponse> => {
  const cacheKey = buildCacheKey(lat, lng);
  const cached = getCachedForecast(cacheKey);
  if (cached) return cached;

  try {
    const response = await weatherClient.get<GoogleWeatherResponse>('', {
      params: {
        location: `POINT(${lng}%20${lat})`,
        units: 'METRIC',
        languageCode: 'th',
        dailyTimeStep: 'DAILY',
        hourlyTimeStep: 'HOURLY',
        currentWeather: true,
        key: env.googleMapsApiKey,
      },
    });

    if (!response.data) {
      throw new Error('Weather API returned empty payload');
    }

    setCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    handleAxiosError(error);
    throw error instanceof Error ? error : new Error('Unknown weather API error');
  }
};

const getCurrentWeather = async (lat: number, lng: number): Promise<CurrentWeather> => {
  const forecast = await fetchForecast(lat, lng);
  const current = forecast.currentConditions;

  if (!current) {
    throw new Error('Weather API returned no current conditions');
  }

  const temperature = scalarToNumber(current.temperature) ?? 0;
  const wind = scalarToNumber(current.windSpeed);
  const precipitation =
    scalarToNumber(current.precipitationIntensity) ?? scalarToNumber(current.precipitationRate);
  const humidity = normalizeHumidity(current.relativeHumidity ?? current.humidity);
  const conditionCode = current.conditionCode;

  const payload: CurrentWeather = {
    time: current.observationTime ?? new Date().toISOString(),
    temperatureC: temperature,
    weatherCode: mapGoogleConditionToWMO(conditionCode),
    conditionText: formatConditionText(conditionCode),
  };

  if (typeof humidity === 'number') {
    payload.humidityPct = humidity;
  }

  if (typeof wind === 'number') {
    payload.windSpeedKph = wind;
  }

  if (typeof precipitation === 'number') {
    payload.rainMm = precipitation;
  }

  return payload;
};

const getDailyForecast = async (lat: number, lng: number, days: number = 7): Promise<DailyForecast[]> => {
  const forecast = await fetchForecast(lat, lng);
  const daily = forecast.dailyForecasts?.days ?? [];

  if (!daily.length) {
    throw new Error('Weather API returned no daily forecast data');
  }

  return daily.slice(0, days).map((day) => {
    const max = scalarToNumber(day.highTemperature) ?? 0;
    const min = scalarToNumber(day.lowTemperature) ?? 0;
    const mean = Number(((max + min) / 2).toFixed(1));
    const conditionCode = day.conditionCode;

    return {
      date: day.startTime ?? day.endTime ?? '',
      temperatureMeanC: mean,
      temperatureMaxC: max,
      temperatureMinC: min,
      weatherCode: mapGoogleConditionToWMO(conditionCode),
      conditionText: formatConditionText(conditionCode),
    };
  });
};

const getHourlyForecast = async (lat: number, lng: number, hours: number = 24): Promise<HourlyForecast[]> => {
  const forecast = await fetchForecast(lat, lng);
  const hourly = forecast.hourlyForecasts?.hours ?? [];

  if (!hourly.length) {
    throw new Error('Weather API returned no hourly forecast data');
  }

  return hourly.slice(0, hours).map((entry) => {
    const conditionCode = entry.conditionCode;
    const precipProbability = normalizeProbability(
      entry.precipitationProbability ?? entry.precipitationChance,
    );

    return {
      time: entry.startTime ?? '',
      temperatureC: scalarToNumber(entry.temperature) ?? 0,
      precipitationProbability: precipProbability,
      weatherCode: mapGoogleConditionToWMO(conditionCode),
      conditionText: formatConditionText(conditionCode),
    };
  });
};

const getLocationName = async (lat: number, lng: number): Promise<LocationInfo> => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat,
        lon: lng,
        'accept-language': 'th',
      },
      headers: {
        'User-Agent': 'DukeFarm/1.0',
      },
    });

    const address = response.data.address || {};
    const district = address.suburb || address.city_district || address.town || '';
    const city = address.city || address.state || '';
    const country = address.country || 'Thailand';

    return {
      name: district && city ? `${district}, ${city}` : city || district || 'Unknown location',
      district,
      city,
      country,
    };
  } catch (error) {
    // Fallback if geocoding fails
    return {
      name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      district: '',
      city: '',
      country: '',
    };
  }
};

export const WeatherService = {
  getCurrentWeather,
  getDailyForecast,
  getHourlyForecast,
  getLocationName,
};

export const __testing__ = {
  forecastCache,
  buildCacheKey,
  setCache,
};
