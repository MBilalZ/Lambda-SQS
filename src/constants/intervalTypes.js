// dbTypes.js
const IntervalType = {
  YEARLY: 'year',
  BIYEARLY: 'bi-yearly',
  MONTHLY: 'month',
  WEEKLY: 'week',
  BIWEEKLY: 'bi-week',
  DAILY: 'day',
};

Object.freeze(IntervalType); // This ensures the object is immutable

module.exports = IntervalType;
