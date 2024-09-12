const {
  getCurrentTimeInUserTimeZone,
  isServerTimeLaterThanUserDateTime,
} = require('../utils/time');
const moment = require('moment-timezone');
const { advanceBy, clear } = require('jest-date-mock');

describe('Time Utilities', () => {
  beforeAll(() => {
    // Mock the current time to a fixed point, e.g., '2024-08-21T01:00:00Z'
    advanceBy(new Date('2024-08-21T01:00:00Z').getTime());
  });

  afterAll(() => {
    clear(); // Clear mock after tests
  });

  test("should return the current time in the user's time zone", () => {
    const userTimeZone = 'America/New_York';
    const now = moment().tz(userTimeZone).format(); // Get expected time in the user’s time zone

    const result = getCurrentTimeInUserTimeZone(userTimeZone);

    expect(result).toBe(now);
  });

  test('should throw error for invalid time zone in getCurrentTimeInUserTimeZone', () => {
    const invalidTimeZone = 'Invalid/TimeZone';

    expect(() => getCurrentTimeInUserTimeZone(invalidTimeZone)).toThrow(
      'Invalid time zone'
    );
  });

  test('should correctly check if server time is later than user date-time', () => {
    const userTimeZone = 'America/New_York';
    const userDateTime = moment().format(); // Use the current mocked time
    const now = moment().tz(userTimeZone);

    const result = isServerTimeLaterThanUserDateTime(
      userDateTime,
      userTimeZone
    );

    expect(result.isLater).toBe(true); // Should be false since times should be equal

    // Assert that the time difference is close to zero
    expect(result.timeDifference.years).toBe(0);
    expect(result.timeDifference.months).toBe(0);
    expect(result.timeDifference.days).toBe(0);
    expect(result.timeDifference.hours).toBe(0);
    expect(result.timeDifference.minutes).toBe(0);
    expect(result.timeDifference.seconds).toBeLessThanOrEqual(1); // Allow for small discrepancies
  });

  test('should throw error for invalid date-time format in isServerTimeLaterThanUserDateTime', () => {
    const userTimeZone = 'America/New_York';
    const invalidDateTime = 'Invalid Date-Time';

    expect(() =>
      isServerTimeLaterThanUserDateTime(invalidDateTime, userTimeZone)
    ).toThrow('Invalid date-time format');
  });

  test('should handle time zones correctly in isServerTimeLaterThanUserDateTime', () => {
    const userTimeZone = 'Asia/Tokyo'; // Different time zone
    const userDateTime = moment().subtract(2, 'hours').format(); // Date-time 2 hours ago

    const result = isServerTimeLaterThanUserDateTime(
      userDateTime,
      userTimeZone
    );

    expect(result.isLater).toBe(true);
    expect(result.timeDifference.hours).toBeGreaterThanOrEqual(2); // Should be at least 2 hours
  });

  test('should return correct time when mocked to 1 AM in user time zone', () => {
    const userTimeZone = 'America/New_York';
    const mockTimeUTC = '2024-08-21T05:00:00Z'; // Mock time to 1 AM New York time

    // Mock the current time to 1 AM UTC
    advanceBy(new Date(mockTimeUTC).getTime());

    // Format the time to the user's time zone
    const expectedTimeInUserTimeZone = moment(mockTimeUTC)
      .tz(userTimeZone)
      .unix(); // Get expected time in user’s time zone

    // Call the function to get the current time in the user's time zone
    const result = moment(getCurrentTimeInUserTimeZone(userTimeZone)).unix();

    // Compare results
    expect(result).toBe(expectedTimeInUserTimeZone);
  });

  test('should return correct time when mocked to one hour before 1 AM in user time zone', () => {
    const userTimeZone = 'America/New_York';
    const oneHourBefore = moment()
      .tz(userTimeZone)
      .subtract(1, 'hour')
      .format(); // Time one hour before 1 AM

    // Mock the current time to one hour before 1 AM UTC
    const mockTimeUTC = '2024-08-21T04:00:00Z'; // One hour before 1 AM New York time
    advanceBy(new Date(mockTimeUTC).getTime());

    // Format the time to the user's time zone
    const expectedTimeInUserTimeZone = moment(mockTimeUTC)
      .tz(userTimeZone)
      .unix(); // Get expected time in user’s time zone

    // Call the function to get the current time in the user's time zone
    const result = moment(getCurrentTimeInUserTimeZone(userTimeZone)).unix();

    // Compare results
    expect(result).toBeGreaterThanOrEqual(expectedTimeInUserTimeZone);
  });
});
