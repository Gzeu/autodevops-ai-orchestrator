import { EventEmitter } from 'events';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowExecutor } from './workflow-executor.js';
import { TaskQueue } from './task-queue.js';
import { StateManager } from './state-manager.js';

export class OrchestrationEngine extends EventEmitter {
  constructor({ integrations, logger }) {
    super();
    this.integrations = integrations;
    this.logger = logger;
    this.workflowExecutor = null;
    this.taskQueue = null;
    this.stateManager = null;
    this.activeWorkflows = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    this.logger.info('Initializing Orchestration Engine...');
    
    // Initialize core components
    this.workflowExecutor = new WorkflowExecutor(this.integrations, this.logger);
    this.taskQueue = new TaskQueue();
    this.stateManager = new StateManager();
    
    await this.workflowExecutor.initialize();
    await this.taskQueue.initialize();
    await this.stateManager.initialize();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    this.logger.info('Orchestration Engine initialized successfully');
  }

  setupEventListeners() {
    this.workflowExecutor.on('workflow:started', (data) => {
      this.emit('workflow:started', data);
    });
    
    this.workflowExecutor.on('workflow:completed', (data) => {
      this.activeWorkflows.delete(data.workflowId);
      this.emit('workflow:completed', data);
    });
    
    this.workflowExecutor.on('workflow:failed', (data) => {
      this.activeWorkflows.delete(data.workflowId);
      this.emit('workflow:failed', data);
    });
  }

  async executeWorkflow(instruction, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Orchestration Engine not initialized');
    }

    const workflowId = uuidv4();
    const workflow = {
      id: workflowId,
      instruction,
      options,
      status: 'pending',
      createdAt: new Date().toISOString(),
      steps: []
    };

    this.activeWorkflows.set(workflowId, workflow);
    this.logger.info(`Starting workflow ${workflowId}: ${instruction}`);

    try {
      // Parse instruction and create workflow plan
      const plan = await this.createWorkflowPlan(instruction, options);
      workflow.plan = plan;
      workflow.status = 'running';

      // Execute workflow
      const result = await this.workflowExecutor.execute(workflow);
      
      workflow.status = 'completed';
      workflow.result = result;
      workflow.completedAt = new Date().toISOString();

      return {
        success: true,
        workflowId,
        result
      };
    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;
      workflow.failedAt = new Date().toISOString();
      
      this.logger.error(`Workflow ${workflowId} failed:`, error);
      
      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }

  async createWorkflowPlan(instruction, options) {
    // Use Task Master AI to analyze instruction and create workflow plan
    const prompt = `
Analyze this development instruction and create a detailed workflow plan:
"${instruction}"

Consider these available integrations:
- GitHub API (repository management, commits, PRs)
- Playwright (testing, browser automation)
- Phoenix (monitoring, observability)
- FastMCP (inter-service communication)

Create a step-by-step plan with:
1. Code analysis/generation steps
2. Testing requirements
3. Repository operations
4. Monitoring setup
5. Deployment considerations

Respond with a JSON workflow plan.
`;

    const aiResponse = await this.integrations.taskMaster.generatePlan(prompt, options);
    return this.parseWorkflowPlan(aiResponse);
  }

  parseWorkflowPlan(aiResponse) {
    // Parse AI response and convert to executable workflow plan
    try {
      const plan = JSON.parse(aiResponse);
      return this.validateWorkflowPlan(plan);
    } catch (error) {
      this.logger.warn('Failed to parse AI workflow plan, using fallback');
      return this.createFallbackPlan();
    }
  }

  validateWorkflowPlan(plan) {
    // Validate and sanitize workflow plan
    const validatedPlan = {
      steps: [],
      estimatedDuration: plan.estimatedDuration || 300, // 5 minutes default
      priority: plan.priority || 'medium',
      dependencies: plan.dependencies || [],
      rollbackStrategy: plan.rollbackStrategy || 'automatic'
    };

    if (plan.steps && Array.isArray(plan.steps)) {
      validatedPlan.steps = plan.steps.map(step => ({
        id: step.id || uuidv4(),
        type: step.type,
        description: step.description,
        integration: step.integration,
        parameters: step.parameters || {},
        timeout: step.timeout || 60000,
        retryCount: step.retryCount || 2
      }));
    }

    return validatedPlan;
  }

  createFallbackPlan() {
    return {
      steps: [
        {
          id: uuidv4(),
          type: 'analyze',
          description: 'Analyze requirements',
          integration: 'taskMaster',
          parameters: {},
          timeout: 30000,
          retryCount: 1
        },
        {
          id: uuidv4(),
          type: 'generate_code',
          description: 'Generate or modify code',
          integration: 'taskMaster',
          parameters: {},
          timeout: 120000,
          retryCount: 2
        },
        {
          id: uuidv4(),
          type: 'run_tests',
          description: 'Execute test suite',
          integration: 'playwright',
          parameters: {},
          timeout: 180000,
          retryCount: 1
        },
        {
          id: uuidv4(),
          type: 'commit_changes',
          description: 'Commit changes to repository',
          integration: 'github',
          parameters: {},
          timeout: 30000,
          retryCount: 2
        }
      ],
      estimatedDuration: 360,
      priority: 'medium',
      dependencies: [],
      rollbackStrategy: 'automatic'
    };
  }

  async getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    return workflow;
  }

  async cancelWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status === 'running') {
      await this.workflowExecutor.cancel(workflowId);
      workflow.status = 'cancelled';
      workflow.cancelledAt = new Date().toISOString();
    }

    this.activeWorkflows.delete(workflowId);
    return workflow;
  }

  async handleWebSocketMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'execute_workflow':
        return await this.executeWorkflow(data.instruction, data.options);
      
      case 'get_workflow_status':
        return await this.getWorkflowStatus(data.workflowId);
      
      case 'cancel_workflow':
        return await this.cancelWorkflow(data.workflowId);
      
      case 'get_active_workflows':
        return Array.from(this.activeWorkflows.values());
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  getMetrics() {
    return {
      activeWorkflows: this.activeWorkflows.size,
      totalWorkflows: this.stateManager.getTotalWorkflows(),
      successRate: this.stateManager.getSuccessRate(),
      averageDuration: this.stateManager.getAverageDuration(),
      uptime: process.uptime()
    };
  }
}