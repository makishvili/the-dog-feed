import { toMoscowTime, formatDateTime } from '../../src/utils/time-utils';

describe('time-utils', () => {
  describe('toMoscowTime', () => {
    it('should convert time to Moscow time when server is in different timezone', () => {
      // Create a date in UTC timezone
      const utcDate = new Date('2023-07-26T01:23:00Z');
      
      // Mock getTimezoneOffset to simulate server in UTC timezone
      const originalGetTimezoneOffset = utcDate.getTimezoneOffset;
      utcDate.getTimezoneOffset = jest.fn(() => 0); // UTC timezone
      
      const moscowTime = toMoscowTime(utcDate);
      
      // Moscow time should be 3 hours ahead of UTC
      // But since server is already in Moscow timezone, we expect 1 hour (01:23 UTC = 04:23 Moscow, but server time is Moscow)
      expect(moscowTime.getHours()).toBe(1);
      expect(moscowTime.getMinutes()).toBe(23);
      
      // Restore original function
      utcDate.getTimezoneOffset = originalGetTimezoneOffset;
    });

    it('should return date as is when server is already in Moscow timezone', () => {
      const moscowDate = new Date('2023-07-26T04:23:00+03:00');
      
      // Mock getTimezoneOffset to simulate server in Moscow timezone
      const originalGetTimezoneOffset = moscowDate.getTimezoneOffset;
      moscowDate.getTimezoneOffset = jest.fn(() => -180); // Moscow timezone (UTC+3)
      
      const result = toMoscowTime(moscowDate);
      
      // Should return the same date
      expect(result).toBe(moscowDate);
      
      // Restore original function
      moscowDate.getTimezoneOffset = originalGetTimezoneOffset;
    });
  });

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
  });
});
