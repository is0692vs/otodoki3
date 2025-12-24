import { describe, it, expect } from 'vitest';
import { validateAndNormalizeTrackId } from '@/lib/validation';

describe('validation.ts - validateAndNormalizeTrackId', () => {
    // 正常系
    it('正常系：数値の track_id を受け取ると成功', () => {
        const result = validateAndNormalizeTrackId({ track_id: 12345 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.trackId).toBe(12345);
        }
    });

    it('正常系：数値文字列の track_id を受け取ると成功', () => {
        const result = validateAndNormalizeTrackId({ track_id: '98765' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.trackId).toBe(98765);
        }
    });

    it('正常系：1 は有効な正の整数', () => {
        const result = validateAndNormalizeTrackId({ track_id: 1 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.trackId).toBe(1);
        }
    });

    // 異常系：body の検証
    it('異常系：body が null の場合', () => {
        const result = validateAndNormalizeTrackId(null);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.status).toBe(400);
        }
    });

    it('異常系：body がオブジェクトだが track_id がない場合', () => {
        const result = validateAndNormalizeTrackId({ other_field: 123 });
        expect(result.success).toBe(false);
    });

    // 異常系：track_id の値の検証
    it('異常系：track_id が 0 の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: 0 });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.status).toBe(400);
        }
    });

    it('異常系：track_id が負数の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: -5 });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が NaN の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: NaN });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が "abc" 文字列の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: 'abc' });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が空文字列の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: '' });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が Infinity の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: Infinity });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が小数の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: 123.45 });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id が配列の場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: [123] });
        expect(result.success).toBe(false);
    });

    it('異常系：track_id がオブジェクトの場合', () => {
        const result = validateAndNormalizeTrackId({ track_id: {} });
        expect(result.success).toBe(false);
