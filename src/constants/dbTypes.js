// dbTypes.js
const DbType = {
  MONGO: 'mongo',
  DOCUMENT: 'document',
};

Object.freeze(DbType); // This ensures the object is immutable

module.exports = DbType;
