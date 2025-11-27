import axios from 'axios';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

type OpenMeteoResponse = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
  };
  current_units: {
    temperature_2m: string;
    relative_humidity_2m: string;
    wind_speed_10m: string;
    precipitation: string;
  };
};

type OpenMeteoDailyResponse = {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_mean: number[];
    weather_code: number[];
  };
  daily_units: {
    temperature_2m_max: string;
    temperature_2m_min: string;
    temperature_2m_mean: string;
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

/**
 * Map Open-Meteo WMO Weather codes to text descriptions
 * Reference: https://open-meteo.com/en/docs
 */
const getWeatherDescription = (code: number): string => {
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  return weatherCodes[code] ?? `Weather code ${code}`;
};

const getCurrentWeather = async (lat: number, lng: number): Promise<CurrentWeather> => {
  try {
    const response = await axios.get<OpenMeteoResponse>(OPEN_METEO_BASE_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        current: [
          'temperature_2m',
          'relative_humidity_2m',
          'precipitation',
          'wind_speed_10m',
          'weather_code',
        ].join(','),
        timezone: 'Asia/Bangkok',
      },
    });

    const { current } = response.data;
    if (!current) {
      throw new Error('Weather API returned no current conditions');
    }

    const payload: CurrentWeather = {
      time: current.time,
      temperatureC: current.temperature_2m,
      humidityPct: current.relative_humidity_2m,
      windSpeedKph: current.wind_speed_10m,
      rainMm: current.precipitation,
      weatherCode: current.weather_code,
      conditionText: getWeatherDescription(current.weather_code),
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
 * Uses Open-Meteo daily aggregations for accurate feeding calculations
 */
const getDailyForecast = async (lat: number, lng: number, days: number = 7): Promise<DailyForecast[]> => {
  try {
    const response = await axios.get<OpenMeteoDailyResponse>(OPEN_METEO_BASE_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'temperature_2m_mean',
          'weather_code',
        ].join(','),
        timezone: 'Asia/Bangkok',
        forecast_days: days,
      },
    });

    const { daily } = response.data;
    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('Weather API returned no daily forecast data');
    }

    const forecasts: DailyForecast[] = daily.time.map((date, index) => ({
      date,
      temperatureMeanC: daily.temperature_2m_mean[index] ?? 0,
      temperatureMaxC: daily.temperature_2m_max[index] ?? 0,
      temperatureMinC: daily.temperature_2m_min[index] ?? 0,
      weatherCode: daily.weather_code[index] ?? 0,
      conditionText: getWeatherDescription(daily.weather_code[index] ?? 0),
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

export const WeatherService = {
  getCurrentWeather,
  getDailyForecast,
};
