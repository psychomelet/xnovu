// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Buffer to store console output during test execution
let consoleBuffer = [];
let currentTestPassed = true;

// Override console methods to buffer output
console.log = (...args) => {
  consoleBuffer.push({ type: 'log', args });
};

console.error = (...args) => {
  consoleBuffer.push({ type: 'error', args });
};

console.warn = (...args) => {
  consoleBuffer.push({ type: 'warn', args });
};

console.info = (...args) => {
  consoleBuffer.push({ type: 'info', args });
};

// Hook into Jest lifecycle
beforeEach(() => {
  consoleBuffer = [];
  currentTestPassed = true;
});

afterEach(() => {
  // Only show console output if test failed
  if (!currentTestPassed && consoleBuffer.length > 0) {
    originalConsole.log('\n--- Console output for failed test ---');
    consoleBuffer.forEach(({ type, args }) => {
      originalConsole[type](...args);
    });
    originalConsole.log('--- End console output ---\n');
  }
  consoleBuffer = [];
});

// Hook into Jest test results
const originalIt = global.it;
global.it = (name, fn, timeout) => {
  return originalIt(name, async (...args) => {
    try {
      const result = await fn(...args);
      currentTestPassed = true;
      return result;
    } catch (error) {
      currentTestPassed = false;
      throw error;
    }
  }, timeout);
};

// Also hook into test.* methods
const originalTest = global.test;
global.test = (name, fn, timeout) => {
  return originalTest(name, async (...args) => {
    try {
      const result = await fn(...args);
      currentTestPassed = true;
      return result;
    } catch (error) {
      currentTestPassed = false;
      throw error;
    }
  }, timeout);
};