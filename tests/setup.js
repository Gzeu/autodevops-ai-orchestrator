import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
global.setTimeout = jest.setTimeout;
jest.setTimeout(30000);

// Mock external services for testing
jest.mock('axios');
jest.mock('ws');

// Setup test database or mock services
beforeAll(async () => {
  console.log('Setting up test environment...');
  // Initialize test database, mock services, etc.
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
  // Cleanup test resources
});

// Global test utilities
global.createMockWorkflow = (overrides = {}) => {
  return {
    id: 'test-workflow-id',
    instruction: 'Test instruction',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides
  };
};

global.createMockIntegration = (name, methods = {}) => {
  const mockIntegration = {
    name,
    isInitialized: true,
    initialize: jest.fn().mockResolvedValue(true),
    cleanup: jest.fn().mockResolvedValue(true),
    ...methods
  };
  
  return mockIntegration;
};