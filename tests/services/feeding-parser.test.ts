import { FeedingParser } from '../../src/services/feeding-parser';

describe('FeedingParser', () => {
  describe('parseDetails', () => {
    it('should parse amount only format', () => {
      const result = FeedingParser.parseDetails('12');
      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(12);
      expect(result.details).toBe('12 граммов');
    });

    it('should parse amount with grams format', () => {
      const result = FeedingParser.parseDetails('12 гр');
      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(12);
      expect(result.details).toBe('12 граммов');
    });

    it('should parse amount with type format', () => {
      const result = FeedingParser.parseDetails('12 грамм сухого');
      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(12);
      expect(result.foodType).toBe('dry');
      expect(result.details).toBe('12 граммов сухого корма');
    });

    it('should parse type with amount format', () => {
      const result = FeedingParser.parseDetails('сухого 25');
      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(25);
      expect(result.foodType).toBe('dry');
      expect(result.details).toBe('25 граммов сухого корма');
    });

    it('should parse complex format', () => {
      const result = FeedingParser.parseDetails('63 влажного');
      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(63);
      expect(result.foodType).toBe('wet');
      expect(result.details).toBe('63 граммов влажного корма');
    });

    it('should handle "не кормим" format', () => {
      const result = FeedingParser.parseDetails('не кормим, потому что спит');
      expect(result.isValid).toBe(true);
      expect(result.details).toBe('не кормим, потому что спит');
    });

    it('should return error for empty input', () => {
      const result = FeedingParser.parseDetails('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Пустое значение');
    });

    it('should validate minimum amount', () => {
      const result = FeedingParser.parseDetails('0');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Минимальное количество: 1 грамм');
    });

    it('should validate maximum amount', () => {
      const result = FeedingParser.parseDetails('600');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Максимальное количество: 500 граммов');
    });

    it('should return input as details if parsing fails', () => {
      const result = FeedingParser.parseDetails('непонятный формат');
      expect(result.isValid).toBe(true);
      expect(result.details).toBe('непонятный формат');
    });
  });

  describe('getExamples', () => {
    it('should return examples array', () => {
      const examples = FeedingParser.getExamples();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe('validateAmount', () => {
    it('should validate minimum amount', () => {
      const result = FeedingParser.validateAmount(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Минимальное количество: 1 грамм');
    });

    it('should validate maximum amount', () => {
      const result = FeedingParser.validateAmount(600);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Максимальное количество: 500 граммов');
    });

    it('should validate correct amount', () => {
      const result = FeedingParser.validateAmount(50);
      expect(result.isValid).toBe(true);
    });
  });
});
