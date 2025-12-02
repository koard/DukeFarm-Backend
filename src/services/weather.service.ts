import axios from 'axios';
import { env } from '../config/env';

const GOOGLE_WEATHER_BASE_URL = 'https://weather.googleapis.com/v1';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

const weatherCache = new Map<string, CacheEntry<unknown>>();

const getCacheKey = (scope: string, lat: number, lng: number, extra: string = ''): string => {
  const coord = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  return `${scope}:${coord}${extra ? `:${extra}` : ''}`;
};

const readCache = <T>(key: string): T | null => {
  const entry = weatherCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    weatherCache.delete(key);
    return null;
  }
  return entry.payload as T;
};

const writeCache = <T>(key: string, payload: T): void => {
  weatherCache.set(key, {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    payload,
  });
};

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

/**
 * Map Google Weather Condition types to WMO Weather codes
 * This ensures compatibility with existing frontend icons
 */
const mapGoogleConditionToWMO = (conditionType: string): number => {
  const mapping: Record<string, number> = {
    'CLEAR': 0,
    'MOSTLY_CLEAR': 1,
    'PARTLY_CLOUDY': 2,
    'CLOUDY': 3,
    'OVERCAST': 3,
    'FOG': 45,
    'MIST': 45,
    'HAZE': 45,
    'LIGHT_RAIN': 61,
    'DRIZZLE': 51,
    'RAIN': 63,
    'SHOWERS': 80,
    'RAIN_SHOWERS': 80,
    'SCATTERED_SHOWERS': 80,
    'HEAVY_RAIN': 65,
    'SNOW': 71,
    'LIGHT_SNOW': 71,
    'HEAVY_SNOW': 75,
    'SNOW_SHOWERS': 85,
    'SLEET': 71, // Mixed rain/snow
    'FREEZING_RAIN': 66,
    'THUNDERSTORM': 95,
    'TORNADO': 99,
    'HURRICANE': 99,
  };

  return mapping[conditionType] ?? 0; // Default to Clear if unknown
};

/**
 * Map WMO codes to text descriptions (kept for fallback or reverse mapping)
 */
const getWeatherDescription = (code: number): string => {
  const weatherCodes: Record<number, string> = {
    1000: 'Clear sky',
    1100: 'Mostly clear',
    1101: 'Partly cloudy',
    1102: 'Mostly cloudy',
    1001: 'Cloudy',
    2000: 'Foggy',
    2100: 'Light fog',
    4000: 'Drizzle',
    4001: 'Rain',
    4200: 'Light rain',
    4201: 'Heavy rain',
    5000: 'Snow',
    5001: 'Flurries',
    5100: 'Light snow',
    5101: 'Heavy snow',
    6000: 'Freezing drizzle',
    6001: 'Freezing rain',
    6200: 'Light freezing rain',
    6201: 'Heavy freezing rain',
    7000: 'Ice pellets',
    7101: 'Heavy ice pellets',
    7102: 'Light ice pellets',
    8000: 'Thunderstorm',
  };

  return weatherCodes[code] ?? `Weather code ${code}`;
};

const getCurrentWeather = async (lat: number, lng: number): Promise<CurrentWeather> => {
  const cacheKey = getCacheKey('current', lat, lng);
  const cached = readCache<CurrentWeather>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const response = await axios.get(`${GOOGLE_WEATHER_BASE_URL}/currentConditions:lookup`, {
      params: {
        key: env.googleMapsApiKey,
        'location.latitude': lat,
        'location.longitude': lng,
        unitsSystem: 'METRIC',
      },
    });

    const data = response.data;
    
    if (!data.temperature) {
      throw new Error('Weather API returned incomplete data');
    }

    const weatherType = data.weatherCondition?.type || 'CLEAR';
    const weatherCode = mapGoogleConditionToWMO(weatherType);
    const conditionText = data.weatherCondition?.description?.text || getWeatherDescription(weatherCode);

    const payload: CurrentWeather = {
      time: data.currentTime || new Date().toISOString(),
      temperatureC: data.temperature?.degrees ?? 0,
      humidityPct: data.relativeHumidity,
      windSpeedKph: data.wind?.speed?.value ?? 0,
      rainMm: data.precipitation?.qpf?.quantity ?? 0,
      weatherCode: weatherCode,
      conditionText: conditionText,
    };
    writeCache(cacheKey, payload);
    return payload;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'network';
      const message =
        typeof error.response?.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response?.data ?? {});

      throw new Error(`Google Weather API error (${status}): ${message || error.message}`);
    }
    throw error;
  }
};

/**
 * Get daily forecast
 */
const getDailyForecast = async (lat: number, lng: number, days: number = 7): Promise<DailyForecast[]> => {
  const cacheKey = getCacheKey('daily', lat, lng, String(days));
  const cached = readCache<DailyForecast[]>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const response = await axios.get(`${GOOGLE_WEATHER_BASE_URL}/forecast/days:lookup`, {
      params: {
        key: env.googleMapsApiKey,
        'location.latitude': lat,
        'location.longitude': lng,
        days: days,
        pageSize: days,
        unitsSystem: 'METRIC',
      },
    });

    const data = response.data;
    if (!data.forecastDays || data.forecastDays.length === 0) {
      throw new Error('Weather API returned no daily forecast data');
    }

    const forecasts: DailyForecast[] = data.forecastDays.map((day: any) => {
      const forecastPart = day.daytimeForecast || day.nighttimeForecast || {};
      const weatherType = forecastPart.weatherCondition?.type || 'CLEAR';
      const weatherCode = mapGoogleConditionToWMO(weatherType);
      const conditionText = forecastPart.weatherCondition?.description?.text || getWeatherDescription(weatherCode);

      const maxTemp = day.maxTemperature?.degrees ?? 0;
      const minTemp = day.minTemperature?.degrees ?? 0;
      const meanTemp = (maxTemp + minTemp) / 2;

      return {
        date: day.displayDate ? `${day.displayDate.year}-${String(day.displayDate.month).padStart(2, '0')}-${String(day.displayDate.day).padStart(2, '0')}` : new Date().toISOString(),
        temperatureMeanC: meanTemp,
        temperatureMaxC: maxTemp,
        temperatureMinC: minTemp,
        weatherCode: weatherCode,
        conditionText: conditionText,
      };
    });

    writeCache(cacheKey, forecasts);
    return forecasts;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'network';
      const message =
        typeof error.response?.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response?.data ?? {});

      throw new Error(`Google Weather API error (${status}): ${message || error.message}`);
    }
    throw error;
  }
};

/**
 * Get hourly forecast
 */
const getHourlyForecast = async (lat: number, lng: number, hours: number = 24): Promise<HourlyForecast[]> => {
  const cacheKey = getCacheKey('hourly', lat, lng, String(hours));
  const cached = readCache<HourlyForecast[]>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const response = await axios.get(`${GOOGLE_WEATHER_BASE_URL}/forecast/hours:lookup`, {
      params: {
        key: env.googleMapsApiKey,
        'location.latitude': lat,
        'location.longitude': lng,
        hours: hours,
        unitsSystem: 'METRIC',
      },
    });

    const data = response.data;
    if (!data.forecastHours || data.forecastHours.length === 0) {
      throw new Error('Weather API returned no hourly forecast data');
    }

    const forecasts: HourlyForecast[] = data.forecastHours.map((hour: any) => {
      const weatherType = hour.weatherCondition?.type || 'CLEAR';
      const weatherCode = mapGoogleConditionToWMO(weatherType);
      const conditionText = hour.weatherCondition?.description?.text || getWeatherDescription(weatherCode);

      return {
        time: hour.interval?.startTime || new Date().toISOString(),
        temperatureC: hour.temperature?.degrees ?? 0,
        precipitationProbability: hour.precipitation?.probability?.percent ?? 0,
        weatherCode: weatherCode,
        conditionText: conditionText,
      };
    });

    writeCache(cacheKey, forecasts);
    return forecasts;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'network';
      const message =
        typeof error.response?.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response?.data ?? {});

      throw new Error(`Google Weather API error (${status}): ${message || error.message}`);
    }
    throw error;
  }
};

/**
 * Get location name from coordinates using Nominatim (OpenStreetMap)
 */
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