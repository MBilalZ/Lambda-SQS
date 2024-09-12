require('dotenv');
const { DBTYPES } = require('./constants/index.js');
const utils = require('./utils/index.js');
const { dbControllerLazyFactory: factory } = require('./db/index.js');
const logger = require('./config/logger.js');
// Initialize DocumentDB client
/**
 * @author Bilal Zahid
 * @description This Lambda function processes various events and performs distinct actions based on the event type.
 * The function handles the following events:
 *   - `fetch-transaction`: Retrieves and processes transactions based on a specified schedule or trigger.
 *   - `create-child-transaction`: Creates child transactions based on input data and triggers.
 *   - `future-transaction`: Manages transactions that are scheduled for future processing.
 *   - `update-child-transaction`: Updates existing child transactions with new data or modifications.
 *
 * It is designed to use a single Lambda function to manage multiple event types. While separate functions could be created for each event type to enhance modularity and manageability, doing so would not necessarily reduce costs. AWS Lambda charges based on the number of invocations and execution time, so deploying multiple functions with the same underlying logic would accumulate costs similarly to a single function handling all events. Thus, a single Lambda function is used to optimize cost and simplify deployment while managing different event types through internal conditional logic.
 *
 * @param {*} event - The event object that contains the data and context for the Lambda function execution.
 * @returns {*} - The result of the Lambda function execution, including status code and response body.
 */
module.exports.handler = async (event, context) => {
  try {
    // Log the event for debugging and processing
    const mongo = await factory.getInstance(DBTYPES.MONGO, 'transactions');
    const document = await factory.getInstance(
      DBTYPES.DOCUMENT,
      'transactions'
    );
    const sqs = await utils.SQS.ensureQueueUrl();
    const dldSQS = await utils.SQS.ensureDeadLetterQueueUrl();
    if (!mongo.isConnected || !document.isConnected || !sqs || !dldSQS) {
      logger.info(`Unable to Connect DB's..`);
      logger.info(`Mong Connected ${mongo.isConnected}`);
      logger.info(`Document Connected ${document.isConnected}`);
      logger.info(`SQS URL ${sqs}`);
      logger.info(`DLD SQS ${dldSQS}`);
      // throw new Error(`Internal Server Error Resources are not ready to use`);
    }
    logger.info(
      `Lambda Remaining time out: ${context.getRemainingTimeInMillis()} ms`
    );
    const eventType =
      event.type ||
      (event.Records
        ? event.Records[0]?.messageAttributes?.type?.stringValue ||
          'process-transactions'
        : undefined);

    // Initialize pagination parameters

    let responese = {
      statusCode: 200,
      body: 'Lambda invoked completed successfully!',
    };
    // Determine the event type and handle accordingly
    switch (eventType) {
      case 'fetch-transactions':
        // Handle fetch-transaction logic
        logger.info('Fetch and Handle The Transactions');
        await utils.transactions.FetchAndHandleTransactions(context);
        break;

      case 'create-child-transaction':
        // Handle create-child-transaction logic
        logger.info('Processing create-child-transaction...');
        // Add your processing logic here
        break;

      case 'process-transactions':
        // Handle future-transaction logic
        logger.info('Processing future-transaction');
        responese = await utils.transactions.processTransactions(
          event?.Records || [],
          context
        );
        // Add your processing logic here
        break;

      case 'update-child-transaction':
        // Handle update-child-transaction logic
        logger.info('Processing update-child-transaction...');
        // Add your processing logic here
        break;

      default:
        logger.error('Unknown event type:', event.type);
        throw new Error('Unsupported event type');
    }

    // Return a successful response
    logger.info(responese);
    return responese;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

// module.exports.rederivePolicyForDeadLetterQueue = async (event, context) => {};
