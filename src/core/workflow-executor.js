import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowExecutor extends EventEmitter {
  constructor(integrations, logger) {
    super();
    this.integrations = integrations;
    this.logger = logger;
    this.runningWorkflows = new Map();
  }

  async initialize() {
    this.logger.info('Workflow Executor initialized');
  }

  async execute(workflow) {
    const { id, plan } = workflow;
    this.runningWorkflows.set(id, workflow);
    
    this.emit('workflow:started', { workflowId: id, plan });
    this.logger.info(`Executing workflow ${id} with ${plan.steps.length} steps`);
    
    const results = [];
    
    try {
      for (const step of plan.steps) {
        this.logger.info(`Executing step ${step.id}: ${step.description}`);
        
        const stepResult = await this.executeStep(step, workflow);
        results.push(stepResult);
        
        workflow.steps.push({
          ...step,
          status: 'completed',
          result: stepResult,
          executedAt: new Date().toISOString()
        });
      }
      
      const finalResult = {
        workflowId: id,
        status: 'completed',
        steps: results,
        summary: this.generateSummary(results)
      };
      
      this.emit('workflow:completed', finalResult);
      return finalResult;
      
    } catch (error) {
      this.logger.error(`Workflow ${id} failed at step:`, error);
      
      const failureResult = {
        workflowId: id,
        status: 'failed',
        error: error.message,
        completedSteps: results.length,
        totalSteps: plan.steps.length
      };
      
      this.emit('workflow:failed', failureResult);
      throw error;
    } finally {
      this.runningWorkflows.delete(id);
    }
  }

  async executeStep(step, workflow) {
    const { type, integration, parameters, timeout } = step;
    
    // Set timeout for step execution
    const stepPromise = this.runStepWithIntegration(type, integration, parameters, workflow);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step ${step.id} timed out after ${timeout}ms`)), timeout);
    });
    
    return await Promise.race([stepPromise, timeoutPromise]);
  }

  async runStepWithIntegration(type, integrationName, parameters, workflow) {
    const integration = this.integrations[integrationName];
    if (!integration) {
      throw new Error(`Integration '${integrationName}' not found`);
    }

    switch (type) {
      case 'analyze':
        return await this.handleAnalyzeStep(integration, parameters, workflow);
      
      case 'generate_code':
        return await this.handleGenerateCodeStep(integration, parameters, workflow);
      
      case 'run_tests':
        return await this.handleRunTestsStep(integration, parameters, workflow);
      
      case 'commit_changes':
        return await this.handleCommitChangesStep(integration, parameters, workflow);
      
      case 'monitor':
        return await this.handleMonitorStep(integration, parameters, workflow);
      
      case 'deploy':
        return await this.handleDeployStep(integration, parameters, workflow);
      
      default:
        throw new Error(`Unknown step type: ${type}`);
    }
  }

  async handleAnalyzeStep(integration, parameters, workflow) {
    const analysis = await integration.analyzeRequirements(workflow.instruction, parameters);
    return {
      type: 'analysis',
      data: analysis,
      timestamp: new Date().toISOString()
    };
  }

  async handleGenerateCodeStep(integration, parameters, workflow) {
    const codeGeneration = await integration.generateCode(workflow.instruction, parameters);
    return {
      type: 'code_generation',
      data: codeGeneration,
      timestamp: new Date().toISOString()
    };
  }

  async handleRunTestsStep(integration, parameters, workflow) {
    const testResults = await integration.runTests(parameters);
    return {
      type: 'test_results',
      data: testResults,
      timestamp: new Date().toISOString()
    };
  }

  async handleCommitChangesStep(integration, parameters, workflow) {
    const commitResult = await integration.commitChanges({
      message: parameters.message || `Automated commit for workflow ${workflow.id}`,
      files: parameters.files || [],
      branch: parameters.branch || 'main'
    });
    return {
      type: 'commit',
      data: commitResult,
      timestamp: new Date().toISOString()
    };
  }

  async handleMonitorStep(integration, parameters, workflow) {
    const monitoringSetup = await integration.setupMonitoring(workflow.id, parameters);
    return {
      type: 'monitoring',
      data: monitoringSetup,
      timestamp: new Date().toISOString()
    };
  }

  async handleDeployStep(integration, parameters, workflow) {
    const deploymentResult = await integration.deploy(parameters);
    return {
      type: 'deployment',
      data: deploymentResult,
      timestamp: new Date().toISOString()
    };
  }

  generateSummary(results) {
    const summary = {
      totalSteps: results.length,
      successfulSteps: results.filter(r => r.data && !r.error).length,
      executionTime: 0,
      artifacts: [],
      recommendations: []
    };

    // Extract artifacts and metrics from results
    results.forEach(result => {
      if (result.type === 'code_generation' && result.data.files) {
        summary.artifacts.push(...result.data.files);
      }
      if (result.type === 'test_results') {
        summary.testsPassed = result.data.passed || 0;
        summary.testsFailed = result.data.failed || 0;
      }
      if (result.type === 'commit') {
        summary.commitSha = result.data.sha;
        summary.commitUrl = result.data.html_url;
      }
    });

    return summary;
  }

  async cancel(workflowId) {
    const workflow = this.runningWorkflows.get(workflowId);
    if (workflow) {
      workflow.status = 'cancelling';
      // Implement cancellation logic here
      this.runningWorkflows.delete(workflowId);
      this.logger.info(`Workflow ${workflowId} cancelled`);
    }
  }
}