const {
  SQSClient,
  GetQueueUrlCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} = require('@aws-sdk/client-sqs');
const logger = require('../config/logger');

class SqsSingleton {
  constructor() {
    if (!SqsSingleton.instance) {
      this.sqsClient = new SQSClient({
        region: process.env.AWS_REGION || 'us-west-2',
      });

      // Fetch and store the queue URLs
      this.queueName = process.env.QUEUE_NAME;
      this.deadLetterQueueName = process.env.DEAD_LETTER_QUEUE_NAME;

      if (!this.queueName) {
        throw new Error('QUEUE_NAME is not set in environment variables');
      }

      this.queueUrl = null;
      this.deadLetterQueueUrl = null;

      this.queueUrlPromise = this.getQueueUrl(this.queueName);
      this.deadLetterQueueUrlPromise = this.deadLetterQueueName
        ? this.getQueueUrl(this.deadLetterQueueName)
        : null;

      SqsSingleton.instance = this;
    }
    return SqsSingleton.instance;
  }

  // Fetch the URL of a queue by name
  async getQueueUrl(queueName) {
    try {
      const command = new GetQueueUrlCommand({ QueueName: queueName });
      const result = await this.sqsClient.send(command);
      return result.QueueUrl;
    } catch (error) {
      logger.error(`Error getting queue URL for ${queueName}:`, error);
      // throw error;
    }
  }

  // Ensure queue URL is fetched and cached
  async ensureQueueUrl() {
    if (!this.queueUrl) {
      this.queueUrl = await this.queueUrlPromise;
    }
    return this.queueUrl;
  }

  // Ensure dead-letter queue URL is fetched and cached
  async ensureDeadLetterQueueUrl() {
    if (!this.deadLetterQueueUrl && this.deadLetterQueueUrlPromise) {
      this.deadLetterQueueUrl = await this.deadLetterQueueUrlPromise;
    }
    return this.deadLetterQueueUrl;
  }

  // Send a message to the SQS FIFO queue
  async sendMessage(transactionObject, MessageAttributes = {}) {
    try {
      const queueUrl = await this.ensureQueueUrl();

      const params = {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(transactionObject),
        MessageGroupId: 'BJJ-TRANSACTIONS-GROUP', // Required for FIFO queues
        MessageDeduplicationId: `${transactionObject?.id || Date.now()}-id`, // Deduplication ID based on transaction ID, time, or current timestamp
        MessageAttributes,
      };

      const command = new SendMessageCommand(params);
      const result = await this.sqsClient.send(command);
      logger.info('Message sent successfully:', result);
      return result;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  // Receive a message from the SQS queue
  async receiveMessage(visibilityTimeout = 30, maxMessages = 1) {
    try {
      const queueUrl = await this.ensureQueueUrl();

      const params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        VisibilityTimeout: visibilityTimeout,
        WaitTimeSeconds: 10,
      };

      const command = new ReceiveMessageCommand(params);
      const result = await this.sqsClient.send(command);
      return result.Messages;
    } catch (error) {
      logger.error('Error receiving message:', error);
      throw error;
    }
  }

  // Delete a message from the SQS queue
  async deleteMessage(receiptHandle) {
    try {
      const queueUrl = await this.ensureQueueUrl();

      const params = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      };

      const command = new DeleteMessageCommand(params);
      const result = await this.sqsClient.send(command);
      logger.info('Message deleted successfully:', result);
      return result;
    } catch (error) {
      logger.error('Error deleting message:', error);
      if (error.name === 'ReceiptHandleIsInvalid') {
        logger.error('Message might have already been deleted:', error);
      } else {
        logger.error('Error deleting message:', error);
        throw error;
      }
    }
  }

  // Update the visibility timeout of a message
  async updateVisibilityTimeout(receiptHandle, visibilityTimeout) {
    try {
      const queueUrl = await this.ensureQueueUrl();

      const params = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeout,
      };

      const command = new ChangeMessageVisibilityCommand(params);
      const result = await this.sqsClient.send(command);
      logger.info('Visibility timeout updated successfully:', result);
      return result;
    } catch (error) {
      logger.error('Error updating visibility timeout:', error);
      throw error;
    }
  }

  // Handle dead-letter queue
  async sendMessageToDeadLetterQueue(transactionObject) {
    try {
      const deadLetterQueueUrl = await this.ensureDeadLetterQueueUrl();
      if (!deadLetterQueueUrl) {
        throw new Error('Dead letter queue URL is not available');
      }

      const params = {
        QueueUrl: deadLetterQueueUrl,
        MessageBody: JSON.stringify(transactionObject),
        MessageGroupId: 'BJJ-TRANSACTIONS-GROUP', // Ensure MessageGroupId is included for FIFO queues
        MessageDeduplicationId: `${transactionObject?.id || transactionObject.time || Date.now()}`,
      };

      const command = new SendMessageCommand(params);
      const result = await this.sqsClient.send(command);
      logger.info('Message sent to dead-letter queue successfully:', result);
      return result;
    } catch (error) {
      logger.error('Error sending message to dead-letter queue:', error);
      throw error;
    }
  }
}

const sqsInstance = new SqsSingleton();

module.exports = sqsInstance;
