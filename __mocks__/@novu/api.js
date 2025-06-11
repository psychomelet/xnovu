const mockNovu = {
  trigger: jest.fn(() => Promise.resolve({ transactionId: 'test-transaction-id' })),
  events: {
    cancel: jest.fn(() => Promise.resolve()),
  },
};

const Novu = jest.fn(() => mockNovu);

module.exports = {
  Novu,
  __esModule: true,
};