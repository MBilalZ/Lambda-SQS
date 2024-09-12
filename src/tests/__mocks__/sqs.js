// __mocks__/sqs.js
const sqs = {
  sendMessage: jest.fn().mockResolvedValue({}),
  receiveMessage: jest.fn().mockResolvedValue({ Messages: [] }),
  deleteMessage: jest.fn().mockResolvedValue({}),
};

module.exports = sqs;
