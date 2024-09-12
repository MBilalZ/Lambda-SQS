const { ObjectId } = require('mongodb'); // Ensure correct import
const { DBTYPES, SUBCRIPTION_INTERVAL_TYPES } = require('../constants');
var { dbControllerLazyFactory: factory } = require('../db/index');
const sqsInstance = require('./sqs');
const datacap = require('./datacap');
const { DATACAP_RESPONSE_CODES } = require('../constants');
const { timeUtils } = require('.');
const logger = require('../config/logger');
const moment = require('moment-timezone');
const { log } = require('winston');
const utils = require('utils');

/**
 * @author Bilal Zahid
 * @description Fetches transactions from the database based on the given type and query parameters.
 * The function allows for options such as projection, sorting, limiting, skipping, and counting the results.
 *
 * @param {string} type - The database type (e.g., 'mongo', 'document').
 * @param {Object} query - The query object to filter transactions.
 * @param {Object} options - Options for projection, sorting, limiting, skipping, and counting results.
 * @returns {Object} - An object containing the fetched transactions and, optionally, the total count.
 */
async function getTransactions(type, query = {}, options = {}) {
  try {
    const collection = (await factory.getInstance(type, 'transactions'))
      .collection;

    const {
      projection = {},
      sort = {},
      limit = 0,
      skip = 0,
      count = false,
    } = options;

    const cursor = collection.find(query).project(projection).sort(sort);

    if (limit > 0) {
      cursor.limit(limit);
    }
    if (skip > 0) {
      cursor.skip(skip);
    }
    const documents = await cursor.toArray();
    let result = { documents };
    if (count) {
      const totalCount = await collection.countDocuments(query);
      result = { documents, count: totalCount };
    }
    return result;
  } catch (err) {
    logger.error('Failed to get transactions', err);
    throw err;
  }
}
/**
 * @author Bilal Zahid
 * @description Updates an existing transaction in the database or inserts a new one if it doesn't exist (upsert).
 *
 * @param {string} type - The database type (e.g., 'mongo', 'document').
 * @param {Object} filter - The filter criteria to find the transaction.
 * @param {Object} updateData - The data to update the transaction with or to insert if it doesn't exist.
 * @returns {Object} - The result of the upsert operation.
 */
async function upsertTransaction(type, filter, updateData) {
  try {
    const collection = (await factory.getInstance(type, 'transactions'))
      .collection;
    updateData.updatedAt = new Date();
    const result = await collection.updateOne(
      filter,
      { $set: updateData },
      { upsert: true }
    );
    logger.info(`Document Upserted...`);
    logger.info(result);
    return result;
  } catch (error) {
    logger.error('Error upserting transaction:', error);
    throw error;
  }
}

/**
 * @author Bilal Zahid
 * @description Adds a new transaction to the specified database collection.
 *
 * @param {string} type - The database type (e.g., 'mongo', 'document').
 * @param {Object} transactionData - The data for the transaction to be added.
 * @returns {Object} - The result of the insert operation.
 */
async function addTransaction(type, transactionData) {
  try {
    const collection = await factory.getInstance(type, 'transactions');
    transactionData.createdAt = new Date();
    transactionData.updatedAt = new Date();
    const result = await collection.create(transactionData);
    return result;
  } catch (error) {
    logger.error('Error adding transaction:', error);
    throw error;
  }
}
async function removeTransaction(type, transactionData) {
  try {
    const collection = await factory.getInstance(type, 'transactions');
    logger.info(collection);
    const result = await collection.deleteOne(transactionData);
    return result;
  } catch (error) {
    logger.error(`Error Removing transaction from ${type}:`, error);
    throw error;
  }
}
/**
 * @description Placeholder function for pushing transactions to SQS.
 * @param {Object} transaction - The transaction data to be pushed to SQS.
 */
async function pushTransactionToSQS(transaction) {
  // TODO: Implement the logic for pushing transactions to SQS.
  //TODO: Need TO Decrease Message IN Future when ready to go in production than we can reduce this.
  logger.info(`Pushing Message to SQS...${transaction?._id}`);
  try {
    await sqsInstance.sendMessage(
      { ...transaction, sendTime: Date.now() },
      {
        Type: {
          DataType: 'String',
          StringValue: 'process-transactions',
        },
      }
    );
  } catch (error) {
    logger.info(`Unable to Send Transaction to SQS....${transaction?._id}`);
    //Removing from DocumentDb
    await updateTransaction(
      DBTYPES.MONGO,
      { _id: transaction?._id },
      { $set: { status: 'future_payment' } }
    );
    logger.info(`Update Back Mongo`);
    // Update the transaction status in MongoDB
  }
}

/**
 * @author Bilal Zahid
 * @description Updates an existing transaction in the database based on the provided filter and update data.
 *
 * @param {string} type - The database type (e.g., 'mongo', 'document').
 * @param {Object} filter - The filter criteria to find the transaction.
 * @param {Object} updateData - The data to update the transaction with.
 * @returns {Object} - The result of the update operation.
 */
async function updateTransaction(type, filter, updateData) {
  try {
    const collection = await factory.getInstance(type, 'transactions');
    if (!updateData.$set) {
      updateData.$set = {};
    }
    updateData.$set.updatedAt = new Date();
    const result = await collection.update(filter, updateData);
    return result;
  } catch (error) {
    logger.error('Error updating transaction:', error);
    throw error;
  }
}
async function getTransaction(type, filter) {
  try {
    const collection = await factory.getInstance(type, 'transactions');
    const result = await collection.getOne(filter);
    return result;
  } catch (error) {
    logger.error('Error Finding transaction:', error);
    throw error;
  }
}

/**
 * @author Bilal Zahid
 * @description Handles a transaction by determining if it should be processed based on its time attribute.
 * The function checks if the server time is later than the user's specified time and processes accordingly.
 *
 * @param {Object} transaction - The transaction data to be handled.
 */
async function handleTransaction(transaction) {
  try {
    if (transaction.time) {
      const timeDifference = timeUtils.isServerTimeLaterThanUserDateTime(
        transaction.time,
        transaction?.recurrence?.timeZone
      );
      logger.info(timeDifference);
      if (
        timeDifference.isLater ||
        parseInt(timeDifference.timeDifferenceInSeconds) <
          Number(process.env.GRACE_TIME_TO_PUSH_MESSAGE_SECONDS)
      ) {
        transaction.status = 'inprogress';
        // Use Promise.all to execute these operations concurrently
        await Promise.all([
          // Add the transaction to DocumentDB
          upsertTransaction(
            DBTYPES.DOCUMENT,
            { _id: transaction._id },
            transaction
          ),

          // Update the transaction status in MongoDB
          updateTransaction(
            DBTYPES.MONGO,
            { _id: transaction._id },
            { $set: { status: transaction.status } }
          ),

          // Push the transaction to SQS
          pushTransactionToSQS(transaction),
        ]);

        logger.info(`Transaction processed successfully: ${transaction._id}`);
      } else {
        logger.info(
          `No need to process this transaction. Time has not reached to process.`
        );
      }
    } else {
      logger.info(`There is no time parameter in the transaction to process.`);
    }
  } catch (error) {
    logger.error('Error processing transaction:', error);
    logger.info(`Unable to handle transaction`, transaction?._id);
  }
}

/**
 * @author Bilal Zahid
 * @description Fetches transactions from the database based on certain criteria.
 * The function allows for options such as pagination and sorting, and it also handles counting the results.
 *
 * @param {number} [limit=null] - The maximum number of transactions to fetch.
 * @param {number} [skip=null] - The number of transactions to skip (for pagination).
 * @returns {Object} - The fetched transactions along with the count if a limit is specified.
 */
async function fetchTransactions(limit = null, skip = null) {
  try {
    const query = {
      status: 'future_payment',
      recurrence: { $exists: true },
      $and: [
        {
          $or: [{ completed: { $exists: false } }, { completed: null }],
        },
        {
          $or: [{ cancelled: { $exists: false } }, { cancelled: null }],
        },
        { 'recurrence.token': { $exists: true } },
        { 'recurrence.recurringData': { $exists: true } },
        { 'recurrence.interval': { $ne: null } },
      ],
    };

    const options = {
      // projection: {
      //   completed: 1,
      //   recurrence: 1,
      //   subscriptionStartDate: 1,
      //   billingDate: 1,
      //   paymentAttempts: 1,
      //   status: 1,
      //   time: 1,
      // },
      sort: { time: 1 },
      limit,
      skip,
      count: limit ? true : false,
    };

    const transactions = await getTransactions('mongo', query, options);
    return transactions;
  } catch (error) {
    logger.info(`Fetching Transactions Error.`, error);
    throw new Error(error);
  }
}

/**
 * Processes a batch of transaction records.
 * Author: Bilal Zahid
 *
 * @param {Array} records - The SQS records to process.
 * @param {Object} context - The Lambda context object.
 * @returns {Object} - Result indicating the processing outcome.
 */
async function processTransactions(records, context) {
  const batchItemFailures = [];
  const graceFullTimeToStopSeconds =
    parseInt(process.env.GRACE_FULL_TIME_TO_STOP_MILLI_SECONDS) || 3000;

  // Use Promise.all to process all records concurrently
  await Promise.all(
    records.map(async (record) => {
      try {
        const transaction = JSON.parse(record.body);
        const transactionData = await getTransactionData(
          toObjectId(transaction._id)
        );
        if (!transaction ) {
          logger.info(`Unable to Find transaction to process so ignoring it.`);
          return;
        }
        if(!transactionData){
          logger.info(`Unable to find transaction data from ${transaction._id}`)
          throw Object.assign(new Error('Retrying transaction'), {
            visibilityTimeout:3600, // Hardcoded fallback value in seconds
          });        
        }
        if (transactionData?.status === 'completed') {
          return; // Skip processing if already completed
        }

        // Check the remaining execution time
        const remainingTime = context.getRemainingTimeInMillis(); // Convert to seconds
        // logger.info(`Remaining execution time: ${remainingTime} seconds`);

        // Simulate a processing condition based on remaining time
        if (remainingTime < graceFullTimeToStopSeconds) {
          throw new Error('Not enough time to complete processing');
        }

        const paymentResponse = await processPayment(
          transactionData,
          record.receiptHandle
        );

        let status = await updateTransactionStatus(
          transactionData._id,
          paymentResponse
        );

        // Delete the message from the queue only if everything went well
        await sqsInstance.deleteMessage(record.receiptHandle);
        //IF process success fully executed than needs to add transaction
        status && (await addNextTransaction(transactionData, paymentResponse));
      } catch (error) {
        logger.error('Error processing message:', error);
        await sqsInstance.updateVisibilityTimeout(
          record.receiptHandle,
          parseInt(error?.visibilityTimeout) || 3600
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    })
  );

  return batchItemFailures.length > 0
    ? { batchItemFailures }
    : { statusCode: 200, body: 'All messages processed successfully' };
}

/**
 * Retrieves transaction data from the database.
 * Author: Bilal Zahid
 *
 * @param {String} transactionId - The ID of the transaction to retrieve.
 * @returns {Object} - The transaction data.
 */
async function getTransactionData(transactionId) {
  return await getTransaction(DBTYPES.MONGO, {
    _id: transactionId,
  });
}

/**
 * Processes a payment using the transaction data.
 * Author: Bilal Zahid
 *
 * @param {Object} transactionData - The transaction data to process.
 * @param {String} receiptHandle - The receipt handle from the SQS message.
 * @returns {Object} - The payment response from the API.
 */
async function processPayment(transactionData, receiptHandle) {
  const payload = {
    Amount: transactionData.recurrence.totalAmount,
    Token: transactionData.recurrence.token,
    InvoiceNo: transactionData._id,
    RecurringData: transactionData.recurrence.recurringData,
  };
  //Here Needs To Fetch Credentials from MongoDB
  const Credentials = await GetManagedAcademyCredentials(
    transactionData.managedAcademy
  );
  if (!Credentials) {
    logger.error(`Unable to Find Credentials`);
    return mapPaymentResponse({
      ResponseOrigin: 'System',
      ReturnCode: '1001', // Assuming "00" indicates success; use an appropriate code for failure if needed
      Status: 'no-initiated',
      Message: 'Credentials not found',
      Account: null,
      Expiration: null,
      Brand: null,
      AuthCode: null,
      RefNo: null,
      InvoiceNo: receiptHandle,
      Amount: payload.Amount,
      Authorized: false,
      RecurringData: payload.RecurringData,
      Token: payload.Token,
      HttpStatus: 500,
    });
  }
  const response = await datacap.postDatacap(
    Credentials?.mid || process.env.DATACAP_MID,
    Credentials?.apiPrivateKey || '',
    process.env.DATACAP_SALE_PATH,
    payload
  );

  const paymentResponse = mapPaymentResponse(response.data, response.status);

  return paymentResponse;
}

/**
 * Maps the API response to a structured format.
 * Author: Bilal Zahid
 *
 * @param {Object} data - The raw API response data.
 * @returns {Object} - The mapped payment response.
 */
function mapPaymentResponse(data, status) {
  return {
    ResponseOrigin: data?.ResponseOrigin,
    ReturnCode: data?.ReturnCode || status,
    Status: data?.Status || status,
    Message: data?.Message,
    Account: data?.Account,
    Expiration: data?.Expiration,
    Brand: data?.Brand,
    AuthCode: data?.AuthCode,
    RefNo: data?.RefNo,
    InvoiceNo: data?.InvoiceNo,
    Amount: data?.Amount,
    Authorized: data?.Authorized,
    RecurringData: data?.RecurringData || 'Recurring',
    Token: data?.Token,
    HttpStatus: Number(status) || 0,
  };
}

/**
 * Updates the transaction status in the database based on the payment response.
 * Author: Bilal Zahid
 *
 * @param {String} transactionId - The ID of the transaction to update.
 * @param {Object} paymentResponse - The response from the payment processing.
 * @returns {Promise} - Resolves when the transaction is updated.
 */
async function updateTransactionStatus(transactionId, paymentResponse) {
  const success =
    paymentResponse?.Status === 'Success' ||
    paymentResponse?.Status === 'Approved';

  const paymentAttempt = {
    user: paymentResponse.user,
    email: paymentResponse.email,
    time: new Date(),
    success: success,
    message: paymentResponse.Message,
    status: paymentResponse.Status,
    refNo: paymentResponse.RefNo,
    amount: paymentResponse.Amount,
    recurringData: paymentResponse.RecurringData,
    invoiceNo: paymentResponse.InvoiceNo,
    returnCode: paymentResponse.ReturnCode,
    tranCode: 'Sale',
    authorized: paymentResponse.Authorized,
  };

  const updateData = {
    $push: { paymentAttempts: paymentAttempt },
  };

  if (
    DATACAP_RESPONSE_CODES.retry[String(paymentResponse.ReturnCode)] ||
    paymentResponse.HttpStatus >= 400
  ) {
    // Retry case
    await Promise.all([
      updateTransaction(DBTYPES.DOCUMENT, { _id: transactionId }, updateData),
      updateTransaction(DBTYPES.MONGO, { _id: transactionId }, updateData),
    ]);
    throw Object.assign(new Error('Retrying transaction'), {
      visibilityTimeout:
        parseInt(
          DATACAP_RESPONSE_CODES?.retry?.[String(paymentResponse.ReturnCode)]
            ?.visibilityTimeout
        ) ||
        parseInt(process?.env?.SQS_VISIBILITY_TIME_OUT_IN_SECONDS) ||
        43200, // Hardcoded fallback value in seconds
    });
  } else {
    // Success or failure case
    const status = success ? 'completed' : 'failed';
    updateData.$set=success? { status,completed:new Date()}: { status,failed:new Date()};
    await Promise.all([
      updateTransaction(DBTYPES.DOCUMENT, { _id: transactionId }, updateData),
      updateTransaction(DBTYPES.MONGO, { _id: transactionId }, updateData),
    ]);
    return status;
  }
}

/**
 * Adds the next recurring transaction based on the parent transaction's recurrence interval.
 *
 * @param {Object} parentTransaction - The parent transaction object containing details like billing date, recurrence interval, etc.
 * @param {Object} paymentResponse - The response object from the payment system containing payment details.
 *
 * @returns {Object|null} - Returns the newly created child transaction if successful, otherwise returns null.
 */
async function addNextTransaction(parentTransaction, paymentResponse) {
  // Determine the base transaction date from either the billing date or the time field
  const transactionDate = new Date(
    parentTransaction.billingDate
      ? parentTransaction.billingDate
      : parentTransaction.time
  );

  // Initialize the next transaction date as the same date as the transaction date
  const nextDate = new Date(transactionDate);

  // Get the recurrence interval from the parent transaction
  const interval = parentTransaction.recurrence.interval;

  // Calculate the next transaction date based on the interval type
  if (interval == SUBCRIPTION_INTERVAL_TYPES.WEEKLY) {
    // For yearly recurrence, add 1 Week
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (interval == SUBCRIPTION_INTERVAL_TYPES.BIWEEKLY) {
    // For biweekly recurrence, add 14 days to the transaction date
    const currentDayOfWeek = transactionDate.getDay(); // Current day of the week (0-6)
    nextDate.setDate(nextDate.getDate() + 14); // Add 14 days

    // Adjust the date to ensure it falls on the same day of the week
    while (nextDate.getDay() !== currentDayOfWeek) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
  } else if (interval == SUBCRIPTION_INTERVAL_TYPES.MONTHLY) {
    // For monthly recurrence, add 1 month
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (interval == SUBCRIPTION_INTERVAL_TYPES.BIYEARLY) {
    // For bi-yearly recurrence, add 6 months
    nextDate.setMonth(nextDate.getMonth() + 6);
  } else if (interval == SUBCRIPTION_INTERVAL_TYPES.YEARLY) {
    // For yearly recurrence, add 1 year
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else {
    // For daily recurrence, add 1 day (default case)
    nextDate.setDate(nextDate.getDate() + 1);
  }

  // Check if there's already a future transaction on the calculated next date
  const Transaction = (await factory.getInstance(DBTYPES.MONGO, 'transactions'))
    .collection;
  const futureTransactions = await Transaction.find({
    managedAcademy: toObjectId(parentTransaction.managedAcademy),
    status: 'future_payment',
    recurrence: { $exists: true },
  });
  let proceed = true;

  if (futureTransactions && futureTransactions.length) {
    for (const t of futureTransactions) {
      // If a transaction with the same date already exists, skip creating a new one
      if (timeUtils.isSameDate(t.time, nextDate)) {
        logger.info('Already existing, skipping.');
        proceed = false;
        break;
      }
    }
  }

  // If no conflict with existing transactions, proceed to create a new child transaction
  if (proceed) {
    logger.info(`Adding Child Transaction`);
    const childTransaction = {
      ...parentTransaction,
      // _id: ObjectId(), // Generate a new ObjectId for the child transaction
      managedAcademy: parentTransaction.managedAcademy,
      processedBy: 'recurringPaymentSystem',
      status: 'future_payment',
      totalAmount: parentTransaction.recurrence.totalAmount,
      paymentAttempts: [],
      parentTransaction: toObjectId(parentTransaction?.parentTransaction),
      completed:null,
      time: nextDate,
      recurrence: {
        interval: parentTransaction.recurrence.interval,
        totalAmount: parentTransaction.recurrence.totalAmount,
        startDate: nextDate,
        product: parentTransaction.product
          ? parentTransaction.product.name
          : 'Membership',
        token: paymentResponse.Token,
        timeZone: parentTransaction?.recurrence?.timeZone || undefined,
        recurringData: paymentResponse?.RecurringData,
      },
    };
    delete childTransaction._id;
    // Add the new child transaction to the database
    const child=await addTransaction(DBTYPES.MONGO, childTransaction);
    logger.info(`Child Transaction:`)
    logger.info(child) 
    return childTransaction;
  } else {
    // If a transaction for the next date already exists, return null
    logger.info(`Unable to add child transaction.For the next date already exists for Same Academy ${parentTransaction.managedAcademy}`);
    return null;
  }
}
/**
 * Author: Bilal Zahid
 * Fetch and handle transactions with pagination and graceful handling of Lambda timeouts.
 *
 * @param {Object} context - AWS Lambda context object to get remaining execution time.
 * @returns {void}
 */
async function FetchAndHandleTransactions(context) {
  try {
    let skip = 0; // Initialize skip for pagination
    const limit = parseInt(process.env.FETCH_LIMIT) || 20; // Set a default limit for the number of transactions to fetch
    let remainingPagination = null; // Initialize remainingPagination to track unprocessed pages

    while (true) {
      const transactions = await fetchTransactions(limit, skip);
      // Process each transaction
      logger.info(`Total Documents In Iteration ${transactions?.documents?.length || 0}`);
      for (const element of transactions.documents) {
        // Check if the remaining Lambda execution time is less than the grace period
        logger.info(`Filtering Future Transaction ID ${String(element._id)} having Payment time ${ new Date(element.time).toISOString()}`);
        if (
          context.getRemainingTimeInMillis() <
          (Number(process.env.GRACE_FULL_TIME_TO_STOP_MILLI_SECONDS) || 5000)
        ) {
          logger.warn(
            'Lambda timeout is near, Gracefully closing the process to fetch and hanlde transactions.'
          );
          remainingPagination = { skip, limit };
          return; // Gracefully exit the loop to avoid Lambda timeout
        }
        await handleTransaction(element);
        skip += 1; // Increment skip after each transaction is processed
      }

      // Exit the loop if there are no more transactions to process or if a timeout is near
      if (!transactions.documents.length || remainingPagination) {
        break; // Gracefully return from the function to ensure the process completes
      }
    }
    return;
  } catch (error) {
    logger.error(`Unable to handle transactions: ${error.message}`); // Log the actual error for debugging
  }
}

/**
 * Fetches the credentials for a given managed academy from the database.
 *
 * @param {string} managedAcademy - The ID of the managed academy for which to fetch credentials.
 * @returns {Object|null} - The credentials object if found, otherwise null.
 * @throws Will throw an error if there is an issue accessing the database.
 */
async function GetManagedAcademyCredentials(managedAcademy) {
  try {
    // Retrieve the MongoDB collection for managed academy credentials
    const collection = await factory.getInstance(
      DBTYPES.MONGO,
      'managedacademycredentials'
    );
    // Query the collection to find credentials for the specified managed academy
    const result = await collection.getOne({
      managedAcademy: toObjectId(managedAcademy),
    });

    // Return the credentials if found, otherwise null
    return result;
  } catch (error) {
    // Log the error if there is an issue finding the credentials
    logger.error('Error finding managed academy credentials:', error);

    // Re-throw the error to allow the calling function to handle it
    throw error;
  }
}
function toObjectId(id) {
  // Check if it's already an ObjectId
  if (id instanceof ObjectId) {
    return id;
  }
  // Check if it's a valid string and convert
  if (ObjectId.isValid(id)) {
    return new ObjectId(id);
  }
  throw new Error('Invalid ObjectId');
}
module.exports = {
  getTransactions,
  addTransaction,
  handleTransaction,
  fetchTransactions,
  processTransactions,
  upsertTransaction,
  removeTransaction,
  pushTransactionToSQS,
  updateTransaction,
  getTransaction,
  getTransactionData,
  processPayment,
  updateTransactionStatus,
  FetchAndHandleTransactions,
  GetManagedAcademyCredentials,
};
