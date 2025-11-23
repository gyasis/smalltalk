#!/usr/bin/env node

/**
 * Unified Test Runner for SmallTalk Interactive Orchestration System
 * Tests Phase 1-3 implementation with comprehensive pass/fail reporting
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class TestRunner {
  constructor() {
    this.results = [];
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  /**
   * Run a single test and capture results
   */
  async runTest(testName, scriptPath, timeout = 30000) {
    console.log(`\n🧪 Running ${testName}...`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn('npx', ['tsx', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        
        const result = {
          name: testName,
          passed: !timedOut && code === 0 && !stderr.includes('Error') && !stderr.includes('TypeError'),
          code,
          duration,
          timedOut,
          stdout: stdout.slice(0, 1000), // Truncate for readability
          stderr: stderr.slice(0, 500),
          summary: this.extractTestSummary(stdout, stderr)
        };

        if (result.passed) {
          this.testsPassed++;
          console.log(`✅ ${testName} PASSED (${duration}ms)`);
        } else {
          this.testsFailed++;
          console.log(`❌ ${testName} FAILED (${duration}ms)`);
          if (timedOut) console.log(`   ⏰ Test timed out after ${timeout}ms`);
          if (stderr) console.log(`   🚨 Error: ${stderr.split('\n')[0]}`);
        }

        this.results.push(result);
        resolve(result);
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        const result = {
          name: testName,
          passed: false,
          code: -1,
          duration: Date.now() - startTime,
          timedOut: false,
          stdout: '',
          stderr: error.message,
          summary: `Failed to start: ${error.message}`
        };

        this.testsFailed++;
        console.log(`❌ ${testName} FAILED - Could not start test`);
        console.log(`   🚨 ${error.message}`);
        
        this.results.push(result);
        resolve(result);
      });
    });
  }

  /**
   * Extract meaningful summary from test output
   */
  extractTestSummary(stdout, stderr) {
    if (stderr) return `Error: ${stderr.split('\n')[0]}`;
    
    // Look for success indicators
    if (stdout.includes('✅') || stdout.includes('All tests completed successfully')) {
      return 'Test completed successfully';
    }
    
    // Look for specific test results
    const lines = stdout.split('\n');
    const summaryLine = lines.find(line => 
      line.includes('completed') || 
      line.includes('success') || 
      line.includes('Analysis complete')
    );
    
    return summaryLine || 'Test execution completed';
  }

  /**
   * Generate detailed test report
   */
  generateReport() {
    const totalTests = this.results.length;
    const passRate = totalTests > 0 ? ((this.testsPassed / totalTests) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SMALLTALK INTERACTIVE ORCHESTRATION TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${this.testsPassed} ✅`);
    console.log(`   Failed: ${this.testsFailed} ❌`);
    console.log(`   Pass Rate: ${passRate}%`);
    
    if (this.testsPassed === totalTests) {
      console.log(`\n🎉 ALL TESTS PASSED! Phase 1-3 Interactive Orchestration System is working correctly.`);
    } else {
      console.log(`\n⚠️  Some tests failed. Please review the detailed results below.`);
    }

    console.log(`\n📋 DETAILED RESULTS:`);
    this.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      console.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Summary: ${result.summary}`);
      
      if (!result.passed) {
        console.log(`   Exit Code: ${result.code}`);
        if (result.stderr) {
          console.log(`   Error Details: ${result.stderr.split('\n')[0]}`);
        }
      }
    });

    console.log('\n' + '='.repeat(80));
    
    return {
      totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      passRate: parseFloat(passRate),
      allPassed: this.testsPassed === totalTests
    };
  }

  /**
   * Check if all test files exist
   */
  async validateTestFiles() {
    const testFiles = [
      'test-simple-integration.ts',
      'test-basic-integration.ts',
      'test-phase3-components.ts'
    ];

    const missingFiles = [];
    
    for (const file of testFiles) {
      try {
        await fs.access(path.join(process.cwd(), file));
      } catch {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      console.log('❌ Missing test files:');
      missingFiles.forEach(file => console.log(`   - ${file}`));
      return false;
    }

    return true;
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 SmallTalk Interactive Orchestration Test Suite');
  console.log('Testing Phase 1-3 Implementation\n');

  const runner = new TestRunner();

  // Validate all test files exist
  console.log('🔍 Validating test files...');
  const filesValid = await runner.validateTestFiles();
  if (!filesValid) {
    console.log('\n❌ Cannot proceed - missing test files');
    process.exit(1);
  }
  console.log('✅ All test files found\n');

  // Define tests to run
  const tests = [
    {
      name: 'Simple Integration Test',
      script: 'test-simple-integration.ts',
      timeout: 20000
    },
    {
      name: 'Basic SmallTalk Features Test',
      script: 'test-basic-integration.ts',
      timeout: 25000
    },
    {
      name: 'Phase 3 Components Test',
      script: 'test-phase3-components.ts',
      timeout: 20000
    }
  ];

  // Run all tests
  console.log(`📋 Running ${tests.length} tests...\n`);
  
  for (const test of tests) {
    await runner.runTest(test.name, test.script, test.timeout);
  }

  // Generate final report
  const summary = runner.generateReport();

  // Exit with appropriate code
  process.exit(summary.allPassed ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test suite
main().catch((error) => {
  console.error('\n💥 Test suite failed:', error.message);
  process.exit(1);
});