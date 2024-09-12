const { MongoMemoryServer } = require('mongodb-memory-server');
const { ControllerLazyFactory } = require('../db/dbControllerLazyFactory');

describe('NoSQLDBClient and ControllerLazyFactory Tests', () => {
  let mongoServer;
  let controllerLazyFactory;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();
    process.env.DOCUMENT_DB_URI = mongoServer.getUri(); // Mocking DocumentDB with MongoDB
    process.env.MONGO_DB_NAME = 'testdb';
    process.env.DOCUMENT_DB_NAME = 'testdbdoc';
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  beforeEach(() => {
    controllerLazyFactory = new ControllerLazyFactory();
  });

  afterEach(async () => {
    await controllerLazyFactory.disconnectAll();
  });

  test('should create and retrieve a document in MongoDB', async () => {
    const client = await controllerLazyFactory.getInstance(
      'mongo',
      'transactions'
    );
    const document = { name: 'Test Transaction', amount: 100 };

    await client.create(document);
    const retrieved = await client.getOne({ name: 'Test Transaction' });

    expect(retrieved).toBeDefined();
    expect(retrieved.name).toBe('Test Transaction');
  });

  test('should create and retrieve a document in DocumentDB (mocked with MongoDB)', async () => {
    const client = await controllerLazyFactory.getInstance(
      'document',
      'processInfo'
    );
    const document = { process: 'Test Process', status: 'initiated' };

    await client.create(document);
    const retrieved = await client.getOne({ process: 'Test Process' });

    expect(retrieved).toBeDefined();
    expect(retrieved.status).toBe('initiated');
  });

  test('should switch between MongoDB and DocumentDB instances', async () => {
    const mongoClient = await controllerLazyFactory.getInstance(
      'mongo',
      'transactions'
    );
    const docClient = await controllerLazyFactory.getInstance(
      'document',
      'processInfo'
    );

    await mongoClient.create({ name: 'Mongo Transaction', amount: 200 });
    await docClient.create({ process: 'Doc Process', status: 'completed' });

    const mongoRetrieved = await mongoClient.getOne({
      name: 'Mongo Transaction',
    });
    const docRetrieved = await docClient.getOne({ process: 'Doc Process' });

    expect(mongoRetrieved).toBeDefined();
    expect(mongoRetrieved.amount).toBe(200);

    expect(docRetrieved).toBeDefined();
    expect(docRetrieved.status).toBe('completed');
  });

  test('should disconnect all instances', async () => {
    const mongoClient = await controllerLazyFactory.getInstance(
      'mongo',
      'transactions'
    );
    const docClient = await controllerLazyFactory.getInstance(
      'document',
      'processInfo'
    );

    await controllerLazyFactory.disconnectAll();

    expect(mongoClient.isConnected).toBe(false);
    expect(docClient.isConnected).toBe(false);
  });
});
