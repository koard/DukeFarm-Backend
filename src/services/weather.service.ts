import axios from 'axios';
import { env } from '../config/env';

const GOOGLE_WEATHER_BASE_URL = 'https://weather.googleapis.com/v1';

type GoogleWeatherCurrentResponse = {
  current: {
    time: string;
    values: {
      temperature: number;
      humidity: number;
      windSpeed: number;
      precipitationIntensity: number;
      weatherCode: number;
    };
  };
};

type GoogleWeatherForecastResponse = {
  forecast: {
    daily: Array<{
      time: string;
      values: {
        temperatureAvg: number;
        temperatureMax: number;
        temperatureMin: number;
        weatherCode: number;
      };
    }>;
  };
};

type GoogleWeatherHourlyResponse = {
  forecast: {
    hourly: Array<{
      time: string;
      values: {
        temperature: number;
        precipitationProbability: number;
        weatherCode: number;
      };
    }>;
  };
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
 * Map Google Weather API codes to text descriptions
 * Reference: https://developers.google.com/maps/documentation/weather
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
  try {
    const apiKey = env.GOOGLE_WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_WEATHER_API_KEY is not configured in environment variables');
    }

    const response = await axios.get(`${GOOGLE_WEATHER_BASE_URL}/current`, {
      params: {
        location: `${lat},${lng}`,
        key: apiKey,
      },
    });

    const { current } = response.data;
    if (!current || !current.values) {
      throw new Error('Weather API returned no current conditions');
    }

    const values = current.values;
    const payload: CurrentWeather = {
      time: current.time || new Date().toISOString(),
      temperatureC: values.temperature ?? 0,
      humidityPct: values.humidity ?? 0,
      windSpeedKph: values.windSpeed ?? 0,
      rainMm: values.precipitationIntensity ?? 0,
      weatherCode: values.weatherCode ?? 1000,
      conditionText: getWeatherDescription(values.weatherCode ?? 1000),
    };

    return payload;
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

/**
 * Get 7-day daily forecast with mean, max, min temperatures
 * Uses Google Weather API daily aggregations for accurate feeding calculations
 */
const getDailyForecast = async (lat: number, lng: number, days: number = 7): Promise<DailyForecast[]> => {
  try {
    const apiKey = env.GOOGLE_WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_WEATHER_API_KEY is not configured in environment variables');
    }

    const response = await axios.get<GoogleWeatherForecastResponse>(`${GOOGLE_WEATHER_BASE_URL}/forecast:daily`, {
      params: {
        location: `${lat},${lng}`,
        key: apiKey,
        days: days,
      },
    });

    const { forecast } = response.data;
    if (!forecast || !forecast.daily || forecast.daily.length === 0) {
      throw new Error('Weather API returned no daily forecast data');
    }

    const forecasts: DailyForecast[] = forecast.daily.map((day) => ({
      date: day.time,
      temperatureMeanC: day.values.temperatureAvg ?? 0,
      temperatureMaxC: day.values.temperatureMax ?? 0,
      temperatureMinC: day.values.temperatureMin ?? 0,
      weatherCode: day.values.weatherCode ?? 1000,
      conditionText: getWeatherDescription(day.values.weatherCode ?? 1000),
    }));

    return forecasts;
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

/**
 * Get hourly forecast for next 24 hours
 */
const getHourlyForecast = async (lat: number, lng: number, hours: number = 24): Promise<HourlyForecast[]> => {
  try {
    const apiKey = env.GOOGLE_WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_WEATHER_API_KEY is not configured in environment variables');
    }

    const response = await axios.get<GoogleWeatherHourlyResponse>(`${GOOGLE_WEATHER_BASE_URL}/forecast:hourly`, {
      params: {
        location: `${lat},${lng}`,
        key: apiKey,
        hours: hours,
      },
    });

    const { forecast } = response.data;
    if (!forecast || !forecast.hourly || forecast.hourly.length === 0) {
      throw new Error('Weather API returned no hourly forecast data');
    }

    const forecasts: HourlyForecast[] = forecast.hourly.slice(0, hours).map((hour) => ({
      time: hour.time,
      temperatureC: hour.values.temperature ?? 0,
      precipitationProbability: hour.values.precipitationProbability ?? 0,
      weatherCode: hour.values.weatherCode ?? 1000,
      conditionText: getWeatherDescription(hour.values.weatherCode ?? 1000),
    }));

    return forecasts;
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
