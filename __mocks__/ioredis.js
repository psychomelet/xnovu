// Mock Redis that can simulate real Redis behavior in tests
const mockRedis = {
  quit: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  ping: jest.fn(() => Promise.resolve('PONG')),
  status: 'ready',
};

const IORedis = jest.fn((url) => {
  // Simulate connection failure for invalid URLs
  if (url && url.includes('nonexistent')) {
    const errorRedis = {
      ...mockRedis,
      status: 'error',
      on: jest.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 10);
        }
      }),
    };
    return errorRedis;
  }
  return mockRedis;
});

IORedis.prototype.quit = jest.fn(() => Promise.resolve());
IORedis.prototype.disconnect = jest.fn(() => Promise.resolve());
IORedis.prototype.on = jest.fn();
IORedis.prototype.ping = jest.fn(() => Promise.resolve('PONG'));

module.exports = IORedis;
module.exports.default = IORedis;
module.exports.__esModule = true;