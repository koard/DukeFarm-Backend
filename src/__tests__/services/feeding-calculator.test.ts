import { FeedingCalculator, FeedingPlanRow } from '../../services/feeding-calculator.service';

describe('FeedingCalculator Service', () => {
  const mockRange = {
    minComfortC: 26,
    maxComfortC: 30,
  };

  describe('computeFeedAdjustment', () => {
    describe('OPTIMAL ZONE (28-35°C)', () => {
      it('should return 0% adjustment for 28°C', () => {
        const result = FeedingCalculator.computeFeedAdjustment(28, mockRange);
        expect(result.adjustmentPct).toBe(0);
        expect(result.recommendation).toBe('normal');
      });

      it('should return 0% adjustment for 30°C', () => {
        const result = FeedingCalculator.computeFeedAdjustment(30, mockRange);
        expect(result.adjustmentPct).toBe(0);
        expect(result.recommendation).toBe('normal');
      });

      it('should return -8% adjustment for 35°C', () => {
        const result = FeedingCalculator.computeFeedAdjustment(35, mockRange);
        expect(result.adjustmentPct).toBe(-8);
        expect(result.recommendation).toBe('decrease');
      });
    });

    describe('COLD ZONE (<28°C)', () => {
      it('should return -90% for extreme cold (<18°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(17, mockRange);
        expect(result.adjustmentPct).toBe(-90);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -60% for very cold (18-21°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(20, mockRange);
        expect(result.adjustmentPct).toBe(-78);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -40% for cold (21-24°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(23, mockRange);
        expect(result.adjustmentPct).toBe(-52);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -6% for mild cool (27°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(27, mockRange);
        expect(result.adjustmentPct).toBe(-4);
        expect(result.recommendation).toBe('decrease');
      });
    });

    describe('HOT ZONE (>35°C)', () => {
      it('should return -6% for entering stress (36°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(36, mockRange);
        expect(result.adjustmentPct).toBe(-17);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -30% for moderate stress (37-39°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(38, mockRange);
        expect(result.adjustmentPct).toBe(-42);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -60% for severe stress (39-41°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(40, mockRange);
        expect(result.adjustmentPct).toBe(-84);
        expect(result.recommendation).toBe('decrease');
      });

      it('should return -85% for critical heat (>41°C)', () => {
        const result = FeedingCalculator.computeFeedAdjustment(42, mockRange);
        expect(result.adjustmentPct).toBe(-90);
        expect(result.recommendation).toBe('decrease');
      });
    });

    describe('Edge cases', () => {
      it('should handle null temperature', () => {
        const result = FeedingCalculator.computeFeedAdjustment(null, mockRange);
        expect(result.adjustmentPct).toBe(0);
        expect(result.recommendation).toBe('normal');
      });

      it('should never exceed -90% adjustment', () => {
        const result = FeedingCalculator.computeFeedAdjustment(-10, mockRange);
        expect(result.adjustmentPct).toBeGreaterThanOrEqual(-90);
        expect(result.adjustmentPct).toBeLessThanOrEqual(0);
      });

      it('should never have positive adjustment', () => {
        const result = FeedingCalculator.computeFeedAdjustment(50, mockRange);
        expect(result.adjustmentPct).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('generateFeedingPlan', () => {
    const startDate = new Date('2025-01-01T00:00:00Z');

    it('should generate 7-day plan by default', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange);
      expect(plan).toHaveLength(7);
    });

    it('should generate custom length plan', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 14);
      expect(plan).toHaveLength(14);
    });

    it('should include all required fields', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 1);
      const row = plan[0];

      expect(row).toHaveProperty('date');
      expect(row).toHaveProperty('meanTemperatureC');
      expect(row).toHaveProperty('highTemperatureC');
      expect(row).toHaveProperty('lowTemperatureC');
      expect(row).toHaveProperty('feedAdjustmentPct');
      expect(row).toHaveProperty('feedingRecommendation');
    });

    it('should have sequential dates', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 3);
      
      const date0 = new Date(plan[0]!.date);
      const date1 = new Date(plan[1]!.date);
      const date2 = new Date(plan[2]!.date);

      expect(date1.getTime() - date0.getTime()).toBe(24 * 60 * 60 * 1000); // 1 day
      expect(date2.getTime() - date1.getTime()).toBe(24 * 60 * 60 * 1000); // 1 day
    });

    it('should have high > mean > low temperatures', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 1);
      const row = plan[0]!;

      if (row.highTemperatureC && row.meanTemperatureC && row.lowTemperatureC) {
        expect(row.highTemperatureC).toBeGreaterThan(row.meanTemperatureC);
        expect(row.meanTemperatureC).toBeGreaterThan(row.lowTemperatureC);
      }
    });

    it('should calculate adjustment based on mean temperature', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 1);
      const row = plan[0]!;

      const expectedAdjustment = FeedingCalculator.computeFeedAdjustment(
        row.meanTemperatureC,
        mockRange
      );

      expect(row.feedAdjustmentPct).toBe(expectedAdjustment.adjustmentPct);
      expect(row.feedingRecommendation).toBe(expectedAdjustment.recommendation);
    });

    it('should use midpoint when current temperature is null', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, null, mockRange, 1);
      const row = plan[0]!;

      const expectedMidpoint = (mockRange.minComfortC + mockRange.maxComfortC) / 2;
      expect(row.meanTemperatureC).toBeCloseTo(expectedMidpoint, 0);
    });

    it('should vary temperatures across days', () => {
      const plan = FeedingCalculator.generateFeedingPlan(startDate, 30, mockRange, 7);
      const temps = plan.map(row => row.meanTemperatureC);
      
      // Check that not all temperatures are the same
      const uniqueTemps = new Set(temps);
      expect(uniqueTemps.size).toBeGreaterThan(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle cool season scenario (Nov-Feb)', () => {
      const startDate = new Date('2025-01-15T00:00:00Z');
      const coolTemp = 24;
      const plan = FeedingCalculator.generateFeedingPlan(startDate, coolTemp, mockRange, 7);

      plan.forEach(row => {
        expect(row.feedAdjustmentPct).toBeLessThanOrEqual(0);
        if (row.meanTemperatureC && row.meanTemperatureC < 28) {
          expect(row.feedingRecommendation).toBe('decrease');
        }
      });
    });

    it('should handle hot season scenario (Mar-May)', () => {
      const startDate = new Date('2025-04-15T00:00:00Z');
      const hotTemp = 37;
      const plan = FeedingCalculator.generateFeedingPlan(startDate, hotTemp, mockRange, 7);

      plan.forEach(row => {
        expect(row.feedAdjustmentPct).toBeLessThanOrEqual(0);
        if (row.meanTemperatureC && row.meanTemperatureC > 35) {
          expect(row.feedingRecommendation).toBe('decrease');
        }
      });
    });

    it('should handle optimal season scenario', () => {
      const startDate = new Date('2025-03-01T00:00:00Z');
      const optimalTemp = 30;
      const plan = FeedingCalculator.generateFeedingPlan(startDate, optimalTemp, mockRange, 7);

      const normalDays = plan.filter(row => row.feedingRecommendation === 'normal');
      expect(normalDays.length).toBeGreaterThan(0);
    });
  });
});
