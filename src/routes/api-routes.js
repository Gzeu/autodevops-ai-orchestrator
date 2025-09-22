import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';

export class APIRoutes {
  constructor(orchestrationEngine) {
    this.orchestrationEngine = orchestrationEngine;
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Workflow management endpoints
    this.router.post('/workflow/execute', 
      this.validateExecuteWorkflow(),
      this.handleExecuteWorkflow.bind(this)
    );
    
    this.router.get('/workflow/:workflowId', 
      this.validateWorkflowId(),
      this.handleGetWorkflowStatus.bind(this)
    );
    
    this.router.delete('/workflow/:workflowId', 
      this.validateWorkflowId(),
      this.handleCancelWorkflow.bind(this)
    );
    
    this.router.get('/workflows', 
      this.handleGetActiveWorkflows.bind(this)
    );
    
    // Metrics and monitoring endpoints
    this.router.get('/metrics', 
      this.handleGetMetrics.bind(this)
    );
    
    this.router.get('/health', 
      this.handleHealthCheck.bind(this)
    );
    
    // Testing endpoints
    this.router.post('/test/run', 
      this.validateRunTests(),
      this.handleRunTests.bind(this)
    );
    
    // Code analysis endpoints
    this.router.post('/analyze', 
      this.validateAnalyzeCode(),
      this.handleAnalyzeCode.bind(this)
    );
    
    // Deployment endpoints
    this.router.post('/deploy', 
      this.validateDeploy(),
      this.handleDeploy.bind(this)
    );
  }

  // Validation middleware
  validateExecuteWorkflow() {
    return [
      body('instruction')
        .notEmpty()
        .withMessage('Instruction is required')
        .isLength({ min: 10, max: 5000 })
        .withMessage('Instruction must be between 10 and 5000 characters'),
      body('options')
        .optional()
        .isObject()
        .withMessage('Options must be an object'),
      body('options.priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Priority must be low, medium, high, or critical'),
      body('options.timeout')
        .optional()
        .isInt({ min: 1000, max: 3600000 })
        .withMessage('Timeout must be between 1000ms and 1 hour')
    ];
  }

  validateWorkflowId() {
    return [
      param('workflowId')
        .isUUID()
        .withMessage('Invalid workflow ID format')
    ];
  }

  validateRunTests() {
    return [
      body('testSuite')
        .optional()
        .isString()
        .withMessage('Test suite must be a string'),
      body('testFiles')
        .optional()
        .isArray()
        .withMessage('Test files must be an array'),
      body('customTests')
        .optional()
        .isArray()
        .withMessage('Custom tests must be an array')
    ];
  }

  validateAnalyzeCode() {
    return [
      body('code')
        .optional()
        .isString()
        .withMessage('Code must be a string'),
      body('files')
        .optional()
        .isArray()
        .withMessage('Files must be an array'),
      body('repository')
        .optional()
        .isObject()
        .withMessage('Repository must be an object')
    ];
  }

  validateDeploy() {
    return [
      body('environment')
        .notEmpty()
        .isIn(['development', 'staging', 'production'])
        .withMessage('Environment must be development, staging, or production'),
      body('branch')
        .optional()
        .isString()
        .withMessage('Branch must be a string')
    ];
  }

  // Route handlers
  async handleExecuteWorkflow(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { instruction, options = {} } = req.body;
      
      const result = await this.orchestrationEngine.executeWorkflow(instruction, {
        ...options,
        requestId: req.headers['x-request-id'] || null,
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  }

  async handleGetWorkflowStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { workflowId } = req.params;
      const workflow = await this.orchestrationEngine.getWorkflowStatus(workflowId);
      
      res.json(workflow);
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message 
        });
      }
    }
  }

  async handleCancelWorkflow(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { workflowId } = req.params;
      const workflow = await this.orchestrationEngine.cancelWorkflow(workflowId);
      
      res.json({ 
        message: 'Workflow cancelled successfully', 
        workflow 
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message 
        });
      }
    }
  }

  async handleGetActiveWorkflows(req, res) {
    try {
      const workflows = Array.from(this.orchestrationEngine.activeWorkflows.values());
      
      // Apply pagination if requested
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedWorkflows = workflows.slice(startIndex, endIndex);
      
      res.json({
        workflows: paginatedWorkflows,
        pagination: {
          page,
          limit,
          total: workflows.length,
          totalPages: Math.ceil(workflows.length / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  }

  async handleGetMetrics(req, res) {
    try {
      const metrics = this.orchestrationEngine.getMetrics();
      
      // Add additional system metrics
      const systemMetrics = {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
      
      res.json({
        ...metrics,
        system: systemMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  }

  async handleHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        integrations: {
          github: this.orchestrationEngine.integrations.github?.isInitialized || false,
          taskMaster: this.orchestrationEngine.integrations.taskMaster?.isInitialized || false,
          fastMCP: this.orchestrationEngine.integrations.fastMCP?.isConnected || false,
          playwright: this.orchestrationEngine.integrations.playwright?.isInitialized || false,
          phoenix: this.orchestrationEngine.integrations.phoenix?.isInitialized || false
        }
      };
      
      // Check if all integrations are healthy
      const allHealthy = Object.values(health.integrations).every(status => status === true);
      
      if (!allHealthy) {
        health.status = 'degraded';
        res.status(503);
      }
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleRunTests(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { testSuite, testFiles, customTests, ...options } = req.body;
      
      const testResults = await this.orchestrationEngine.integrations.playwright.runTests({
        testSuite,
        testFiles,
        customTests,
        ...options
      });
      
      res.json({
        success: true,
        results: testResults
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Test execution failed', 
        message: error.message 
      });
    }
  }

  async handleAnalyzeCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { code, files, repository, ...options } = req.body;
      
      let analysisResult;
      
      if (code) {
        // Analyze provided code
        analysisResult = await this.orchestrationEngine.integrations.taskMaster.analyzeRequirements(
          `Analyze this code: ${code}`, 
          { ...options, type: 'code_analysis' }
        );
      } else if (repository) {
        // Analyze repository
        analysisResult = await this.orchestrationEngine.integrations.github.analyzeRequirements(
          'Analyze repository structure and code quality',
          { ...options, repository }
        );
      } else {
        return res.status(400).json({ 
          error: 'Either code or repository must be provided' 
        });
      }
      
      res.json({
        success: true,
        analysis: analysisResult
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Code analysis failed', 
        message: error.message 
      });
    }
  }

  async handleDeploy(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { environment, branch, ...options } = req.body;
      
      // Create deployment workflow
      const deploymentInstruction = `Deploy application to ${environment} environment${
        branch ? ` from ${branch} branch` : ''
      }`;
      
      const result = await this.orchestrationEngine.executeWorkflow(deploymentInstruction, {
        ...options,
        type: 'deployment',
        environment,
        branch: branch || 'main'
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Deployment failed', 
        message: error.message 
      });
    }
  }

  getRouter() {
    return this.router;
  }
}