const logger = require('../config/logger');

const dbControllerLazyFactory =
  new (require('../db/dbControllerLazyFactory').ControllerLazyFactory)();
module.exports = {
  dbControllerLazyFactory,
};
