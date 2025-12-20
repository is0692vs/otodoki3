import { validateMetadata } from '../track-pool';

describe('validateMetadata', () => {
    it('should return null for null or undefined', () => {
        expect(validateMetadata(null)).toBeNull();
        expect(validateMetadata(undefined)).toBeNull();
    });

    it('should return null for arrays', () => {
        expect(validateMetadata([])).toBeNull();
        expect(validateMetadata([1, 2, 3])).toBeNull();
    });

    it('should parse valid JSON strings', () => {
        const result = validateMetadata('{"key":"value"}');
        expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON strings', () => {
        expect(validateMetadata('invalid json')).toBeNull();
    });

    it('should return null for JSON string arrays', () => {
        expect(validateMetadata('["item1", "item2"]')).toBeNull();
    });

    it('should accept valid objects', () => {
        const obj = { key: 'value' };
        expect(validateMetadata(obj)).toEqual(obj);
    });

    it('should return null for primitive types', () => {
        expect(validateMetadata(42)).toBeNull();
        expect(validateMetadata(true)).toBeNull();
    });
});
