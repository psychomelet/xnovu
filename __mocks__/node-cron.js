const mockTask = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn(),
  getStatus: jest.fn(() => 'scheduled'),
};

const schedule = jest.fn(() => mockTask);
const validate = jest.fn(() => true);

module.exports = {
  schedule,
  validate,
  __esModule: true,
};