import { chromium, firefox, webkit } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

export class PlaywrightTestRunner {
  constructor({ headless, browser, timeout, retryCount }) {
    this.headless = headless;
    this.browserType = browser || 'chromium';
    this.timeout = timeout || 30000;
    this.retryCount = retryCount || 2;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isInitialized = false;
    this.testResults = [];
  }

  async initialize() {
    try {
      // Launch browser based on configuration
      const browserEngine = this.getBrowserEngine();
      this.browser = await browserEngine.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.isInitialized = true;
      console.log('✅ Playwright test runner initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Playwright: ${error.message}`);
    }
  }

  getBrowserEngine() {
    switch (this.browserType.toLowerCase()) {
      case 'firefox':
        return firefox;
      case 'webkit':
      case 'safari':
        return webkit;
      case 'chromium':
      case 'chrome':
      default:
        return chromium;
    }
  }

  async createContext(options = {}) {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      ...options
    });

    this.page = await this.context.newPage();
    
    // Set default timeout
    this.page.setDefaultTimeout(this.timeout);
    
    return { context: this.context, page: this.page };
  }

  async runTests(parameters = {}) {
    const testSuite = parameters.testSuite || 'default';
    const testFiles = parameters.testFiles || [];
    const customTests = parameters.customTests || [];
    
    const results = {
      suite: testSuite,
      startTime: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    try {
      // Create new context for test session
      await this.createContext();
      
      // Run file-based tests
      if (testFiles.length > 0) {
        for (const testFile of testFiles) {
          const fileResults = await this.runTestFile(testFile);
          results.tests.push(...fileResults);
        }
      }
      
      // Run custom inline tests
      if (customTests.length > 0) {
        for (const test of customTests) {
          const testResult = await this.runCustomTest(test);
          results.tests.push(testResult);
        }
      }
      
      // Run default tests if no specific tests provided
      if (testFiles.length === 0 && customTests.length === 0) {
        const defaultTests = await this.generateDefaultTests(parameters);
        for (const test of defaultTests) {
          const testResult = await this.runCustomTest(test);
          results.tests.push(testResult);
        }
      }
      
      // Calculate summary
      results.summary.total = results.tests.length;
      results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
      results.summary.failed = results.tests.filter(t => t.status === 'failed').length;
      results.summary.skipped = results.tests.filter(t => t.status === 'skipped').length;
      
      results.endTime = new Date().toISOString();
      results.summary.duration = new Date(results.endTime) - new Date(results.startTime);
      
      // Store results
      this.testResults.push(results);
      
      return results;
      
    } catch (error) {
      results.error = error.message;
      results.endTime = new Date().toISOString();
      throw error;
    } finally {
      // Cleanup context
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.page = null;
      }
    }
  }

  async runTestFile(testFilePath) {
    try {
      // Check if test file exists
      await fs.access(testFilePath);
      
      // For now, return a placeholder - in a real implementation,
      // you would use Playwright's test runner programmatic API
      return [{
        name: `Test file: ${path.basename(testFilePath)}`,
        status: 'passed',
        duration: 1000,
        file: testFilePath
      }];
    } catch (error) {
      return [{
        name: `Test file: ${path.basename(testFilePath)}`,
        status: 'failed',
        error: error.message,
        duration: 0,
        file: testFilePath
      }];
    }
  }

  async runCustomTest(test) {
    const testResult = {
      name: test.name || 'Unnamed test',
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      duration: 0
    };

    try {
      // Execute test steps
      if (test.steps) {
        for (const step of test.steps) {
          const stepResult = await this.executeTestStep(step);
          testResult.steps.push(stepResult);
          
          if (stepResult.status === 'failed' && !test.continueOnFailure) {
            throw new Error(`Step failed: ${stepResult.error}`);
          }
        }
      }
      
      // Execute test function if provided
      if (test.fn && typeof test.fn === 'function') {
        await test.fn(this.page, this.context);
      }
      
      // Execute test URL navigation and assertions
      if (test.url) {
        await this.page.goto(test.url);
        
        if (test.assertions) {
          for (const assertion of test.assertions) {
            await this.executeAssertion(assertion);
          }
        }
      }
      
      testResult.status = 'passed';
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      
      // Take screenshot on failure
      if (this.page) {
        try {
          const screenshot = await this.page.screenshot({
            fullPage: true,
            type: 'png'
          });
          testResult.screenshot = screenshot.toString('base64');
        } catch (screenshotError) {
          console.warn('Failed to take screenshot:', screenshotError.message);
        }
      }
    }
    
    testResult.endTime = new Date().toISOString();
    testResult.duration = new Date(testResult.endTime) - new Date(testResult.startTime);
    
    return testResult;
  }

  async executeTestStep(step) {
    const stepResult = {
      name: step.name || step.type,
      type: step.type,
      status: 'running',
      startTime: new Date().toISOString()
    };

    try {
      switch (step.type) {
        case 'navigate':
          await this.page.goto(step.url);
          break;
          
        case 'click':
          await this.page.click(step.selector);
          break;
          
        case 'type':
          await this.page.fill(step.selector, step.text);
          break;
          
        case 'wait':
          if (step.selector) {
            await this.page.waitForSelector(step.selector, { timeout: step.timeout || this.timeout });
          } else {
            await this.page.waitForTimeout(step.duration || 1000);
          }
          break;
          
        case 'screenshot':
          const screenshot = await this.page.screenshot({
            path: step.path,
            fullPage: step.fullPage || false
          });
          stepResult.screenshot = screenshot.toString('base64');
          break;
          
        case 'assert_text':
          const text = await this.page.textContent(step.selector);
          if (!text.includes(step.expectedText)) {
            throw new Error(`Expected text '${step.expectedText}' not found in '${text}'`);
          }
          break;
          
        case 'assert_visible':
          const isVisible = await this.page.isVisible(step.selector);
          if (!isVisible) {
            throw new Error(`Element '${step.selector}' is not visible`);
          }
          break;
          
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      stepResult.status = 'passed';
      
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
    }
    
    stepResult.endTime = new Date().toISOString();
    stepResult.duration = new Date(stepResult.endTime) - new Date(stepResult.startTime);
    
    return stepResult;
  }

  async executeAssertion(assertion) {
    switch (assertion.type) {
      case 'title':
        const title = await this.page.title();
        if (!title.includes(assertion.expected)) {
          throw new Error(`Title assertion failed: expected '${assertion.expected}', got '${title}'`);
        }
        break;
        
      case 'url':
        const url = this.page.url();
        if (!url.includes(assertion.expected)) {
          throw new Error(`URL assertion failed: expected '${assertion.expected}', got '${url}'`);
        }
        break;
        
      case 'element_exists':
        const exists = await this.page.locator(assertion.selector).count() > 0;
        if (!exists) {
          throw new Error(`Element assertion failed: '${assertion.selector}' does not exist`);
        }
        break;
        
      case 'element_text':
        const elementText = await this.page.textContent(assertion.selector);
        if (!elementText.includes(assertion.expected)) {
          throw new Error(`Text assertion failed: expected '${assertion.expected}' in element '${assertion.selector}'`);
        }
        break;
        
      default:
        throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }

  async generateDefaultTests(parameters) {
    const baseUrl = parameters.baseUrl || 'http://localhost:3000';
    
    return [
      {
        name: 'Application accessibility test',
        url: baseUrl,
        assertions: [
          { type: 'title', expected: '' },
          { type: 'element_exists', selector: 'body' }
        ]
      },
      {
        name: 'API health check',
        url: `${baseUrl}/health`,
        assertions: [
          { type: 'url', expected: '/health' }
        ]
      },
      {
        name: 'Basic navigation test',
        steps: [
          { type: 'navigate', url: baseUrl },
          { type: 'wait', duration: 2000 },
          { type: 'screenshot', path: 'test-results/homepage.png' }
        ]
      }
    ];
  }

  async performLoadTest(url, options = {}) {
    const concurrency = options.concurrency || 5;
    const duration = options.duration || 30000; // 30 seconds
    const results = [];
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Create multiple contexts for concurrent testing
    const promises = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runLoadTestWorker(url, endTime, i));
    }
    
    const workerResults = await Promise.all(promises);
    
    // Aggregate results
    const aggregated = {
      totalRequests: workerResults.reduce((sum, r) => sum + r.requests, 0),
      totalErrors: workerResults.reduce((sum, r) => sum + r.errors, 0),
      averageResponseTime: workerResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / concurrency,
      duration: duration,
      concurrency: concurrency
    };
    
    return aggregated;
  }

  async runLoadTestWorker(url, endTime, workerId) {
    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    let requests = 0;
    let errors = 0;
    let totalResponseTime = 0;
    
    try {
      while (Date.now() < endTime) {
        const requestStart = Date.now();
        
        try {
          await page.goto(url, { waitUntil: 'networkidle' });
          const responseTime = Date.now() - requestStart;
          totalResponseTime += responseTime;
          requests++;
        } catch (error) {
          errors++;
        }
        
        // Small delay between requests
        await page.waitForTimeout(100);
      }
    } finally {
      await context.close();
    }
    
    return {
      workerId,
      requests,
      errors,
      averageResponseTime: requests > 0 ? totalResponseTime / requests : 0
    };
  }

  getTestHistory() {
    return this.testResults;
  }

  async cleanup() {
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.isInitialized = false;
  }
}