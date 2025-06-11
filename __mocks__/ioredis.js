const mockRedis = {
  quit: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
};

const IORedis = jest.fn(() => mockRedis);
IORedis.prototype.quit = jest.fn(() => Promise.resolve());
IORedis.prototype.disconnect = jest.fn(() => Promise.resolve());
IORedis.prototype.on = jest.fn();

module.exports = IORedis;
module.exports.default = IORedis;
module.exports.__esModule = true;