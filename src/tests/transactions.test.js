require('dotenv').config({ path: '../../.env' });

const { MongoClient, ObjectId } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { DBTYPES } = require('../constants');
const {
  getTransactions,
  upsertTransaction,
  addTransaction,
  removeTransaction,
  pushTransactionToSQS,
  updateTransaction,
  getTransaction,
  handleTransaction,
  fetchTransactions,
  processTransactions,
  getTransactionData,
  processPayment,
  updateTransactionStatus,
} = require('../utils/transactions');
const sqsInstance = require('../services/sqs');
const datacap = require('../services/datacap');
const utils = require('../utils'); // Adjust this path based on your setup
console.log(process.env);

jest.mock('../utils/sqs');
jest.mock('../utils/datacap');
jest.mock('../utils'); // Adjust this path based on your setup

let mongoServer;
let client;
let db;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('test');
});

beforeEach(async () => {
  await db.collection('transactions').deleteMany({});
});

afterAll(async () => {
  await client.close();
  await mongoServer.stop();
});

describe('Transaction Service Tests', () => {
  describe('getTransactions', () => {
    it('should fetch transactions with correct parameters', async () => {
      await db.collection('transactions').insertMany([
        { _id: new ObjectId(), status: 'future_payment', amount: 100 },
        { _id: new ObjectId(), status: 'completed', amount: 200 },
      ]);

      const result = await getTransactions(
        DBTYPES.MONGO,
        {},
        { sort: { amount: -1 }, limit: 1 }
      );
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].amount).toBe(200);
    });
  });

  describe('upsertTransaction', () => {
    it('should upsert a transaction', async () => {
      const filter = { _id: new ObjectId() };
      const updateData = { amount: 150 };

      const result = await upsertTransaction(DBTYPES.MONGO, filter, updateData);
      expect(result.upsertedCount).toBe(1);

      const doc = await db.collection('transactions').findOne(filter);
      expect(doc.amount).toBe(150);
    });
  });

  describe('addTransaction', () => {
    it('should add a new transaction', async () => {
      const transactionData = { _id: new ObjectId(), amount: 200 };

      const result = await addTransaction(DBTYPES.MONGO, transactionData);
      expect(result.insertedCount).toBe(1);

      const doc = await db
        .collection('transactions')
        .findOne({ _id: transactionData._id });
      expect(doc.amount).toBe(200);
    });
  });

  describe('removeTransaction', () => {
    it('should remove a transaction', async () => {
      const transactionData = { _id: new ObjectId(), amount: 300 };
      await db.collection('transactions').insertOne(transactionData);

      const result = await removeTransaction(DBTYPES.MONGO, {
        _id: transactionData._id,
      });
      expect(result.deletedCount).toBe(1);

      const doc = await db
        .collection('transactions')
        .findOne({ _id: transactionData._id });
      expect(doc).toBeNull();
    });
  });

  describe('pushTransactionToSQS', () => {
    it('should push a transaction to SQS', async () => {
      const transaction = { _id: new ObjectId(), amount: 400 };

      sqsInstance.sendMessage.mockResolvedValue({});

      await pushTransactionToSQS(transaction);
      expect(sqsInstance.sendMessage).toHaveBeenCalledWith(
        { ...transaction, sendTime: expect.any(Number) },
        { Type: { DataType: 'String', StringValue: 'process-transactions' } }
      );
    });
  });

  describe('updateTransaction', () => {
    it('should update a transaction', async () => {
      const filter = { _id: new ObjectId() };
      await db.collection('transactions').insertOne({ ...filter, amount: 500 });

      const updateData = { amount: 600 };
      const result = await updateTransaction(DBTYPES.MONGO, filter, updateData);
      expect(result.modifiedCount).toBe(1);

      const doc = await db.collection('transactions').findOne(filter);
      expect(doc.amount).toBe(600);
    });
  });

  describe('getTransaction', () => {
    it('should get a single transaction', async () => {
      const transactionData = { _id: new ObjectId(), amount: 700 };
      await db.collection('transactions').insertOne(transactionData);

      const result = await getTransaction(DBTYPES.MONGO, {
        _id: transactionData._id,
      });
      expect(result._id).toEqual(transactionData._id);
      expect(result.amount).toBe(700);
    });
  });

  describe('handleTransaction', () => {
    it('should handle a transaction correctly', async () => {
      const transaction = {
        _id: new ObjectId(),
        time: new Date(),
        recurrence: { timeZone: 'UTC', totalAmount: 800, token: 'token123' },
      };

      utils.timeUtils.isServerTimeLaterThanUserDateTime.mockReturnValue({
        isLater: true,
      });

      await handleTransaction(transaction);

      const doc = await db
        .collection('transactions')
        .findOne({ _id: transaction._id });
      expect(doc.status).toBe('inprogress');
    });
  });

  describe('fetchTransactions', () => {
    it('should fetch future payment transactions', async () => {
      await db.collection('transactions').insertMany([
        { _id: new ObjectId(), status: 'future_payment', amount: 900 },
        { _id: new ObjectId(), status: 'completed', amount: 1000 },
      ]);

      const transactions = await fetchTransactions(1, 0);
      expect(transactions.documents.length).toBe(1);
      expect(transactions.documents[0].amount).toBe(900);
    });
  });

  describe('processTransactions', () => {
    it('should process a batch of transactions', async () => {
      const transaction = {
        _id: new ObjectId(),
        recurrence: { totalAmount: 1000, token: 'token123', recurringData: {} },
      };
      const record = {
        body: JSON.stringify(transaction),
        messageId: 'message1',
        receiptHandle: 'receipt1',
      };

      sqsInstance.deleteMessage.mockResolvedValue({});
      datacap.postDatacap.mockResolvedValue({ data: { Status: 'Success' } });

      await processTransactions([record], {
        getRemainingTimeInMillis: () => 60000,
      });

      const doc = await db
        .collection('transactions')
        .findOne({ _id: transaction._id });
      expect(doc).not.toBeNull();
    });
  });

  describe('processPayment', () => {
    it('should process payment correctly', async () => {
      const transactionData = {
        recurrence: { totalAmount: 1100, token: 'token123' },
      };
      datacap.postDatacap.mockResolvedValue({
        data: { Status: 'Success', ...transactionData.recurrence },
      });

      const response = await processPayment(transactionData, 'receipt1');
      expect(response.Status).toBe('Success');
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status based on payment response', async () => {
      const transactionId = new ObjectId();
      await db
        .collection('transactions')
        .insertOne({ _id: transactionId, amount: 1200 });

      const paymentResponse = {
        Status: 'Success',
        Message: 'Transaction Approved',
      };
      await updateTransactionStatus(transactionId, paymentResponse);

      const doc = await db
        .collection('transactions')
        .findOne({ _id: transactionId });
      expect(doc.status).toBe('completed');
      expect(doc.paymentAttempts.length).toBeGreaterThan(0);
    });
  });
});
