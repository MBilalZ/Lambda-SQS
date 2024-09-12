const moment = require('moment-timezone');

/**
 * @description Validates if the given time zone string is valid.
 * @param {string} timeZone - The IANA time zone string.
 * @returns {boolean} - Returns true if valid, false otherwise.
 */
function isValidTimeZone(timeZone) {
  return moment.tz.names().includes(timeZone);
}

/**
 * @description Returns the current time in the user's time zone based on the server's current time.
 * @param {string} userTimeZone - The IANA time zone string for the user (e.g., 'America/New_York').
 * @returns {string} - Returns the current time in the user's time zone in ISO 8601 format (e.g., '2024-08-16T08:00:00-04:00').
 */
function getCurrentTimeInUserTimeZone(userTimeZone = 'America/New_York') {
  if (!isValidTimeZone(userTimeZone)) {
    throw new Error('Invalid time zone');
  }
  const now = moment().tz(userTimeZone);
  return now.format(); // ISO 8601 format
}

/**
 * @description Checks if the current server time is later than a specific date-time provided by the user in their time zone,
 * and also returns the time difference.
 * @param {string} userTimeZone - The IANA time zone string (e.g., 'America/New_York').
 * @param {string} userDateTime - The date-time provided by the user in ISO 8601 format (e.g., '2024-08-16T23:00:00').
 * @returns {object} - Returns an object indicating if the server time is later and the time difference.
 */
function isServerTimeLaterThanUserDateTime(
  userDateTime,
  userTimeZone = 'America/New_York'
) {
  if (!isValidTimeZone(userTimeZone)) {
    throw new Error('Invalid time zone');
  }

  // Validate userDateTime format
  if (!moment(userDateTime, moment.ISO_8601, true).isValid()) {
    throw new Error('Invalid date-time format');
  }

  const now = moment().tz(userTimeZone);
  const userTimeDate = moment
    .tz(userDateTime, userTimeZone)
    .startOf('day')
    .add(1, 'hour'); //Setting 1 AM OF DAY
  const isLater = now.isAfter(userTimeDate);

  let timeDifference = moment.duration(userTimeDate.diff(now));

  if (isLater) {
    timeDifference = moment.duration(now.diff(userTimeDate)); // Duration if time is in the past
  }

  const result = {
    isLater,
    timeDifference: {
      years: timeDifference.years(),
      months: timeDifference.months(),
      days: timeDifference.days(),
      hours: timeDifference.hours(),
      minutes: timeDifference.minutes(),
      seconds: timeDifference.seconds(),
    },
    timeDifferenceInSeconds: timeDifference.asSeconds(),
  };

  return result;
}
function isToday(dateParam, timezone = 'America/New_York') {
  const today = moment().tz(timezone).startOf('day');
  const dateToCheck = moment(dateParam).tz(timezone).startOf('day');

  return today.isSame(dateToCheck);
}
/**
 * Checks if two dates are the same (ignoring time).
 *
 * @param {Date} date1 - The first date to compare.
 * @param {Date} date2 - The second date to compare.
 * @returns {boolean} - Returns true if the dates are the same, false otherwise.
 */
function isSameDate(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Example usage:
const date1 = new Date('2024-08-28T10:00:00Z');
const date2 = new Date('2024-08-28T15:30:00Z');
// console.log(isSameDate(date1, date2)); // Output: true

module.exports = {
  getCurrentTimeInUserTimeZone,
  isServerTimeLaterThanUserDateTime,
  isToday,
  isSameDate,
};
