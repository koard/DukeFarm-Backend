import { NextFunction, Request, Response } from 'express';
import { PondService } from '../services/pond.service';
import { createHttpError } from '../utils/httpError';

export const PondController = {
    getActiveCycle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (!id) throw createHttpError(400, 'Pond ID is required');
            const cycle = await PondService.getActiveCycle(id);
            res.json({ data: cycle });
        } catch (error) {
            next(error);
        }
    },

    endCycle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (!id) throw createHttpError(400, 'Pond ID is required');
            const cycle = await PondService.closeActiveCycle(id);
            res.json({ data: cycle });
        } catch (error) {
            next(error);
        }
    },

    listCycles: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (!id) throw createHttpError(400, 'Pond ID is required');
            const cycles = await PondService.listCycles(id);
            res.json({ data: cycles });
        } catch (error) {
            next(error);
        }
    },

    getCycleCount: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (!id) throw createHttpError(400, 'Pond ID is required');
            const count = await PondService.countCycles(id);
            res.json({ data: { count } });
        } catch (error) {
            next(error);
        }
    },

    startNewCycle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (!id) throw createHttpError(400, 'Pond ID is required');
            const { farmType } = req.body || {};
            const cycle = await PondService.startNewCycle(id, farmType);
            res.status(201).json({ data: cycle });
        } catch (error) {
            next(error);
        }
    },
};
