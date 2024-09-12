const { DBTYPES } = require('../constants');
const NoSQLDBClient = require('./NoSqlClient');
class ControllerLazyFactory {
  constructor() {
    if (ControllerLazyFactory.instance) {
      return ControllerLazyFactory.instance;
    }
    this.instances = {};
    this.defaultMongoUri = process.env.MONGO_URI;
    this.defaultDocumentUri = process.env.DOCUMENT_DB_URI;
    this.defaultMongoDbName = process.env.MONGO_DB_NAME;
    this.defaultDocumentDbName = process.env.DOCUMENT_DB_NAME;
  }

  setMongoUri(uri) {
    this.mongoUri = uri || this.defaultMongoUri;
  }

  setDocumentUri(uri) {
    this.documentUri = uri || this.defaultDocumentUri;
  }

  setDefaultMongoDbName(dbName) {
    this.defaultMongoDbName = dbName;
  }

  setDefaultDocumentDbName(dbName) {
    this.defaultDocumentDbName = dbName;
  }

  async getInstance(type, collectionName, dbName) {
    let uri, defaultDbName;

    if (type === DBTYPES.MONGO) {
      uri = this.mongoUri || this.defaultMongoUri;
      defaultDbName = this.defaultMongoDbName;
    } else if (type === DBTYPES.DOCUMENT) {
      uri = this.documentUri || this.defaultDocumentUri;
      defaultDbName = this.defaultDocumentDbName;
    } else {
      if (!Object.values(DBTYPES).includes(type)) {
        throw new Error(
          `Invalid type. Type must be one of: ${Object.values(DBTYPES).join(', ')}`
        );
      }
    }

    // Use default database name if not provided
    dbName = dbName || defaultDbName;

    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    const key = `${type}-${dbName}`;

    if (!this.instances[key]) {
      this.instances[key] = new NoSQLDBClient(uri, dbName, collectionName);
      await this.instances[key].connect();
    } else {
      await this.instances[key].connect();
      this.instances[key].setCollection(dbName, collectionName);
    }
    return this.instances[key];
  }

  async disconnectAll() {
    // Disconnect all instances
    for (const instance of Object.values(this.instances)) {
      await instance.disconnect(); // Ensure disconnect is called on each instance
    }
  }
}

module.exports = {
  ControllerLazyFactory,
};
