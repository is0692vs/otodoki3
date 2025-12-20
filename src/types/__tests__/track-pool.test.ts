import { createWeight } from '../track-pool';

describe('createWeight', () => {
    it('should create valid weights', () => {
        expect(createWeight(0)).toBe(0);
        expect(createWeight(0.5)).toBe(0.5);
        expect(createWeight(1)).toBe(1);
    });

    it('should throw for negative weights', () => {
        expect(() => createWeight(-0.1)).toThrow('Weight must be between 0.0 and 1.0');
        expect(() => createWeight(-1)).toThrow('Weight must be between 0.0 and 1.0');
    });

    it('should throw for weights greater than 1', () => {
        expect(() => createWeight(1.1)).toThrow('Weight must be between 0.0 and 1.0');
        expect(() => createWeight(2)).toThrow('Weight must be between 0.0 and 1.0');
    });

    it('should throw for NaN', () => {
        expect(() => createWeight(NaN)).toThrow('Weight must be between 0.0 and 1.0');
    });

    it('should throw for Infinity', () => {
        expect(() => createWeight(Infinity)).toThrow('Weight must be between 0.0 and 1.0');
        expect(() => createWeight(-Infinity)).toThrow('Weight must be between 0.0 and 1.0');
    });
});
