import { parseOptionalNumber, decimalToNumber } from '../../utils/number';
import { HttpError } from '../../utils/httpError';

describe('parseOptionalNumber', () => {
  it('should parse a valid number string', () => {
    expect(parseOptionalNumber('42', 'age')).toBe(42);
  });

  it('should parse a float string', () => {
    expect(parseOptionalNumber('3.14', 'weight')).toBeCloseTo(3.14);
  });

  it('should parse a numeric value', () => {
    expect(parseOptionalNumber(100, 'count')).toBe(100);
  });

  it('should return undefined for undefined', () => {
    expect(parseOptionalNumber(undefined, 'field')).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(parseOptionalNumber(null, 'field')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(parseOptionalNumber('', 'field')).toBeUndefined();
  });

  it('should throw HttpError 400 for non-finite value (NaN)', () => {
    expect(() => parseOptionalNumber('abc', 'temperature')).toThrow(HttpError);
    try {
      parseOptionalNumber('abc', 'temperature');
    } catch (e) {
      expect((e as HttpError).status).toBe(400);
      expect((e as HttpError).message).toBe('temperature must be a number');
    }
  });

  it('should throw HttpError 400 for Infinity', () => {
    expect(() => parseOptionalNumber(Infinity, 'val')).toThrow(HttpError);
  });

  it('should throw HttpError 400 for -Infinity', () => {
    expect(() => parseOptionalNumber(-Infinity, 'val')).toThrow(HttpError);
  });

  it('should parse zero correctly', () => {
    expect(parseOptionalNumber('0', 'field')).toBe(0);
    expect(parseOptionalNumber(0, 'field')).toBe(0);
  });

  it('should parse negative numbers', () => {
    expect(parseOptionalNumber('-5', 'offset')).toBe(-5);
  });
});

describe('decimalToNumber', () => {
  it('should convert a valid number', () => {
    expect(decimalToNumber(42)).toBe(42);
  });

  it('should convert a string number', () => {
    expect(decimalToNumber('3.14')).toBeCloseTo(3.14);
  });

  it('should return null for null', () => {
    expect(decimalToNumber(null)).toBeNull();
  });

  it('should return null for undefined', () => {
    expect(decimalToNumber(undefined)).toBeNull();
  });

  it('should return null for NaN string', () => {
    expect(decimalToNumber('not-a-number')).toBeNull();
  });

  it('should handle zero', () => {
    expect(decimalToNumber(0)).toBe(0);
    expect(decimalToNumber('0')).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(decimalToNumber(-10)).toBe(-10);
  });

  it('should return null for Infinity', () => {
    expect(decimalToNumber(Infinity)).toBeNull();
  });
});
