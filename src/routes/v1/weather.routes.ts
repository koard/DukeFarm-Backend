import { Router } from 'express';
import { WeatherController } from '../../controllers/weather.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/weather', authMiddleware, WeatherController.getByCoordinates);
router.get('/weather/hourly', authMiddleware, WeatherController.getHourlyForecast);
router.get('/weather/daily', authMiddleware, WeatherController.getDailyForecast);
router.get('/weather/location', authMiddleware, WeatherController.getLocationInfo);
router.get('/weather/complete', authMiddleware, WeatherController.getCompleteWeather);

export { router as weatherRouter };
