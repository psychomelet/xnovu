const mockQueue = {
  add: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
  getJobCounts: jest.fn(() => Promise.resolve({ waiting: 0, active: 0, completed: 0, failed: 0 })),
};

const mockWorker = {
  close: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
};

const mockQueueEvents = {
  close: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
};

const Queue = jest.fn(() => mockQueue);
const Worker = jest.fn(() => mockWorker);
const QueueEvents = jest.fn(() => mockQueueEvents);

module.exports = {
  Queue,
  Worker,
  QueueEvents,
  __esModule: true,
};