const { MongoClient } = require('mongodb');
const logger = require('../config/logger');

class NoSQLDBClient {
  constructor(uri, dbName = MONGO_DB_NAME, collectionName) {
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.client = new MongoClient(this.uri, {
      minPoolSize: Number(process.env.NO_SQL_MIN_POOL_SIZE) || 5,
      maxPoolSize: Number(process.env.NO_SQL_MAX_POOL_SIZE) || 10,
    });
    this.db = null;
    this.isConnected = false;
    this.collection = null;
  }
  async connect() {
    if (!this?.isConnected) {
      try {
        await this.client.connect();
        this.client.on('connectionClosed', (event) => {
          logger.info(`Connection Closed`);
          logger.info(event);
          this.isConnected = false;
        });
        logger.info(`Connected to NoSQL database ${this.dbName}`);
        this.db = this.client.db(this.dbName);
        this.collection = this.db.collection(this.collectionName);
        this.isConnected = true;
      } catch (err) {
        logger.error('Failed to connect to NoSQL database', err);
        throw err;
      }
    }
  }

  async disconnect() {
    if (this.isConnected) {
      try {
        await this.client.close();
        this.isConnected = false;
        logger.info('Disconnected from NoSQL database');
      } catch (err) {
        logger.error('Failed to disconnect from NoSQL database', err);
        throw err;
      }
    }
  }

  setCollection(dbName, collectionName) {
    this.dbName = dbName;
    this.collectionName = collectionName;
    if (this.db) {
      this.collection = this.db.collection(collectionName);
    }
  }

  // Add other methods like create, find, update, delete, etc.
  async create(document) {
    try {
      const result = await this.collection.insertOne(document);
      logger.info('Document inserted:', result.insertedId);
      return result;
    } catch (err) {
      logger.error('Failed to insert document', err);
      throw err;
    }
  }

  async getOne(query) {
    try {
      const document = await this.collection.findOne(query);
      logger.info(`Document Found:`);
      logger.info(document);

      return document;
    } catch (err) {
      logger.error('Failed to find document', err);
      throw err;
    }
  }

  async getAll(query = {}) {
    try {
      const documents = await this.collection.find(query).toArray();
      logger.info('Documents found:', documents);
      return documents;
    } catch (err) {
      logger.error('Failed to find documents', err);
      throw err;
    }
  }

  async getAllWithPagination(query = {}, page = 1, pageSize = 10) {
    try {
      const documents = await this.collection
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray();
      logger.info(`Documents found (Page: ${page}):`, documents);
      return documents;
    } catch (err) {
      logger.error('Failed to find documents with pagination', err);
      throw err;
    }
  }

  async update(filter, update) {
    try {
      const result = await this.collection.updateOne(filter, update);
      logger.info('Document updated:', result.modifiedCount);
      return result;
    } catch (err) {
      logger.error('Failed to update document', err);
      throw err;
    }
  }

  async deleteOne(query) {
    try {
      const result = await this.collection.deleteOne(query);
      logger.info('Document deleted:', result.deletedCount);
      return result;
    } catch (err) {
      logger.error('Failed to delete document', err);
      throw err;
    }
  }

  async aggregate(pipeline) {
    try {
      const result = await this.collection.aggregate(pipeline).toArray();
      logger.info('Aggregation result:', result);
      return result;
    } catch (err) {
      logger.error('Failed to perform aggregation', err);
      throw err;
    }
  }
}

module.exports = NoSQLDBClient;
