import { NextFunction, Request, Response } from 'express';
import { PondService } from '../services/pond.service';

export const PondController = {
    getActiveCycle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const cycle = await PondService.getActiveCycle(id);
            res.json({ data: cycle });
        } catch (error) {
            next(error);
        }
    },

    endCycle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const cycle = await PondService.closeActiveCycle(id);
            res.json({ data: cycle });
        } catch (error) {
            next(error);
        }
    },
};
