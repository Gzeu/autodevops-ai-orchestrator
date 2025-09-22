import { jest } from '@jest/globals';
import { OrchestrationEngine } from '../../src/core/orchestration-engine.js';
import winston from 'winston';

// Mock integrations
const mockIntegrations = {
  github: createMockIntegration('github', {
    analyzeRequirements: jest.fn().mockResolvedValue({ analysis: 'mock analysis' }),
    commitChanges: jest.fn().mockResolvedValue({ sha: 'mock-sha' })
  }),
  taskMaster: createMockIntegration('taskMaster', {
    generatePlan: jest.fn().mockResolvedValue(JSON.stringify({
      steps: [
        {
          id: 'test-step',
          type: 'analyze',
          description: 'Test step',
          integration: 'taskMaster',
          parameters: {},
          timeout: 30000,
          retryCount: 1
        }
      ],
      estimatedDuration: 60
    })),
    analyzeRequirements: jest.fn().mockResolvedValue({ requirements: 'mock requirements' })
  }),
  fastMCP: createMockIntegration('fastMCP'),
  playwright: createMockIntegration('playwright', {
    runTests: jest.fn().mockResolvedValue({ passed: 1, failed: 0 })
  }),
  phoenix: createMockIntegration('phoenix')
};

// Mock logger
const mockLogger = winston.createLogger({
  level: 'silent',
  transports: []
});

describe('OrchestrationEngine', () => {
  let orchestrationEngine;

  beforeEach(() => {
    orchestrationEngine = new OrchestrationEngine({
      integrations: mockIntegrations,
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await orchestrationEngine.initialize();
      expect(orchestrationEngine.isInitialized).toBe(true);
    });
  });

  describe('workflow execution', () => {
    beforeEach(async () => {
      await orchestrationEngine.initialize();
    });

    test('should execute workflow successfully', async () => {
      const instruction = 'Create a simple API endpoint';
      const result = await orchestrationEngine.executeWorkflow(instruction);
      
      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(mockIntegrations.taskMaster.generatePlan).toHaveBeenCalledWith(
        expect.stringContaining(instruction),
        {}
      );
    });

    test('should handle workflow failure gracefully', async () => {
      // Mock a failure in task master
      mockIntegrations.taskMaster.generatePlan.mockRejectedValueOnce(
        new Error('AI service unavailable')
      );
      
      const instruction = 'This will fail';
      const result = await orchestrationEngine.executeWorkflow(instruction);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('AI service unavailable');
    });

    test('should validate workflow plan', () => {
      const invalidPlan = { steps: 'not-an-array' };
      const validatedPlan = orchestrationEngine.validateWorkflowPlan(invalidPlan);
      
      expect(Array.isArray(validatedPlan.steps)).toBe(true);
      expect(validatedPlan.estimatedDuration).toBeDefined();
    });

    test('should create fallback plan when AI fails', () => {
      const fallbackPlan = orchestrationEngine.createFallbackPlan();
      
      expect(Array.isArray(fallbackPlan.steps)).toBe(true);
      expect(fallbackPlan.steps.length).toBeGreaterThan(0);
      expect(fallbackPlan.estimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('workflow management', () => {
    beforeEach(async () => {
      await orchestrationEngine.initialize();
    });

    test('should get workflow status', async () => {
      const workflow = createMockWorkflow();
      orchestrationEngine.activeWorkflows.set(workflow.id, workflow);
      
      const status = await orchestrationEngine.getWorkflowStatus(workflow.id);
      expect(status).toEqual(workflow);
    });

    test('should throw error for non-existent workflow', async () => {
      await expect(orchestrationEngine.getWorkflowStatus('non-existent'))
        .rejects.toThrow('Workflow non-existent not found');
    });

    test('should cancel running workflow', async () => {
      const workflow = createMockWorkflow({ status: 'running' });
      orchestrationEngine.activeWorkflows.set(workflow.id, workflow);
      
      const cancelledWorkflow = await orchestrationEngine.cancelWorkflow(workflow.id);
      
      expect(cancelledWorkflow.status).toBe('cancelled');
      expect(orchestrationEngine.activeWorkflows.has(workflow.id)).toBe(false);
    });
  });

  describe('metrics', () => {
    test('should return current metrics', () => {
      const metrics = orchestrationEngine.getMetrics();
      
      expect(metrics).toHaveProperty('activeWorkflows');
      expect(metrics).toHaveProperty('uptime');
      expect(typeof metrics.activeWorkflows).toBe('number');
    });
  });
});