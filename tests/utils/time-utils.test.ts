import { formatDateTime } from '../../src/utils/time-utils';

describe('time-utils', () => {
  describe('formatDateTime', () => {
    it('should format date in "day month at hours:minutes" format', () => {
      // Create a date in Moscow timezone
      const date = new Date('2023-07-26T04:23:00+03:00');
      
      // Mock getMonth to return July (6)
      const originalGetMonth = date.getMonth;
      date.getMonth = jest.fn(() => 6);
      
      const formatted = formatDateTime(date);
      
      expect(formatted).toBe('26 июля в 04:23');
      
      // Restore original function
      date.getMonth = originalGetMonth;
    });

    it('should pad single digit hours and minutes with zero', () => {
      // Create a date with single digit hour and minute
      const date = new Date('2023-01-01T01:01:00+03:00');
      
      // Mock getMonth to return January (0)
      const originalGetMonth = date.getMonth;
      date.getMonth = jest.fn(() => 0);
      
      const formatted = formatDateTime(date);
      
      expect(formatted).toBe('1 января в 01:01');
      
      // Restore original function
      date.getMonth = originalGetMonth;
    });

    it('should format date with timezone - Moscow', () => {
      // Create a date in UTC
      const date = new Date('2023-07-26T01:23:00Z');
      
      // Mock getMonth to return July (6)
      const originalGetMonth = date.getMonth;
      date.getMonth = jest.fn(() => 6);
      
      const formatted = formatDateTime(date, 'Europe/Moscow');
      
      expect(formatted).toBe('26 июля в 04:23');
      
      // Restore original function
      date.getMonth = originalGetMonth;
    });

    it('should format date with timezone - New York', () => {
      // Create a date in UTC
      const date = new Date('2023-07-26T01:23:00Z');
      
      // Mock getMonth to return July (6)
      const originalGetMonth = date.getMonth;
      date.getMonth = jest.fn(() => 6);
      
      const formatted = formatDateTime(date, 'America/New_York');
      
      expect(formatted).toBe('25 июля в 21:23');
      
      // Restore original function
      date.getMonth = originalGetMonth;
    });
  });
});
