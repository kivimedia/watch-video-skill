import { describe, it, expect } from 'vitest';
import {
  isRTLLanguage,
  detectTextDirection,
  containsHebrew,
  containsArabic,
  containsRTL,
  isMixedDirection,
  getTextDirection,
} from '@cutsense/core';

describe('RTL Utilities', () => {
  describe('isRTLLanguage', () => {
    it('should detect Hebrew', () => {
      expect(isRTLLanguage('he')).toBe(true);
      expect(isRTLLanguage('iw')).toBe(true);
      expect(isRTLLanguage('heb')).toBe(true);
    });

    it('should detect Arabic', () => {
      expect(isRTLLanguage('ar')).toBe(true);
      expect(isRTLLanguage('ara')).toBe(true);
    });

    it('should return false for LTR languages', () => {
      expect(isRTLLanguage('en')).toBe(false);
      expect(isRTLLanguage('es')).toBe(false);
      expect(isRTLLanguage('fr')).toBe(false);
    });

    it('should handle subtags', () => {
      expect(isRTLLanguage('he-IL')).toBe(true);
      expect(isRTLLanguage('ar-SA')).toBe(true);
      expect(isRTLLanguage('en-US')).toBe(false);
    });
  });

  describe('detectTextDirection', () => {
    it('should detect Hebrew text as RTL', () => {
      expect(detectTextDirection('שלום עולם')).toBe('rtl');
    });

    it('should detect English text as LTR', () => {
      expect(detectTextDirection('Hello world')).toBe('ltr');
    });

    it('should handle mixed text by majority', () => {
      expect(detectTextDirection('שלום hello שלום עולם')).toBe('rtl');
      expect(detectTextDirection('Hello world שלום')).toBe('ltr');
    });
  });

  describe('containsHebrew', () => {
    it('should detect Hebrew characters', () => {
      expect(containsHebrew('שלום')).toBe(true);
      expect(containsHebrew('hello')).toBe(false);
      expect(containsHebrew('hello שלום')).toBe(true);
    });
  });

  describe('containsArabic', () => {
    it('should detect Arabic characters', () => {
      expect(containsArabic('مرحبا')).toBe(true);
      expect(containsArabic('hello')).toBe(false);
    });
  });

  describe('isMixedDirection', () => {
    it('should detect mixed Hebrew/English', () => {
      expect(isMixedDirection('שלום world')).toBe(true);
      expect(isMixedDirection('שלום עולם')).toBe(false);
      expect(isMixedDirection('hello world')).toBe(false);
    });
  });

  describe('getTextDirection', () => {
    it('should return default for empty text', () => {
      expect(getTextDirection('', 'ltr')).toBe('ltr');
      expect(getTextDirection('  ', 'rtl')).toBe('rtl');
    });
  });
});
