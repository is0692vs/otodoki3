import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('クラス名を正しく結合する', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('条件付きクラスを正しく処理する', () => {
      expect(cn('class1', false && 'class2', 'class3')).toBe('class1 class3');
      expect(cn('class1', true && 'class2')).toBe('class1 class2');
    });

    it('Tailwindのクラスの競合を解決する', () => {
      // p-4 (padding: 1rem) と p-2 (padding: 0.5rem) がある場合、最後のが勝つ
      expect(cn('p-4', 'p-2')).toBe('p-2');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('undefinedやnullを無視する', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
    });

    it('配列入力を処理する', () => {
       expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });
  });
});
