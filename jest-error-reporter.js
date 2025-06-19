class ErrorCollectorReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this._errors = [];
  }

  onTestResult(test, testResult, aggregatedResult) {
    // Collect failed tests with their errors
    if (testResult.numFailingTests > 0) {
      testResult.testResults.forEach(result => {
        if (result.status === 'failed') {
          this._errors.push({
            testPath: testResult.testFilePath,
            testName: result.fullName,
            error: result.failureMessages.join('\n'),
            duration: result.duration
          });
        }
      });
    }
  }

  onRunComplete(contexts, results) {
    // Show failed tests summary
    if (this._errors.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🔥 FAILED TESTS SUMMARY');
      console.log('='.repeat(80));
      
      this._errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.testName}`);
        console.log(`   File: ${error.testPath.replace(process.cwd(), '.')}`);
        console.log(`   Duration: ${error.duration}ms`);
        console.log('   Error:');
        console.log(error.error.split('\n').map(line => '   ' + line).join('\n'));
        console.log('-'.repeat(80));
      });
      
      console.log(`\n📊 Total failed tests: ${this._errors.length}`);
      console.log('='.repeat(80));
    }

    // Show console error logs summary
    const errorLogs = global.getAllErrorLogs ? global.getAllErrorLogs() : [];
    if (errorLogs.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🚨 CONSOLE ERROR LOGS SUMMARY');
      console.log('='.repeat(80));
      
      errorLogs.forEach((log, index) => {
        console.log(`\n${index + 1}. [${log.timestamp}]`);
        console.log('   Error:', ...log.args);
        console.log('-'.repeat(40));
      });
      
      console.log(`\n📊 Total console errors: ${errorLogs.length}`);
      console.log('='.repeat(80));
    }

    // Overall summary
    if (this._errors.length > 0 || errorLogs.length > 0) {
      console.log('\n' + '🔍 Review the error summaries above for details');
    }
  }
}

module.exports = ErrorCollectorReporter;