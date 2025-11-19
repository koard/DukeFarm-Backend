import { Router } from 'express';
import { WeatherController } from '../../controllers/weather.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/weather', authMiddleware, WeatherController.getByCoordinates);

export { router as weatherRouter };
