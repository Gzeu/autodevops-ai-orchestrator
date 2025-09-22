import { Router } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';

export class WebhookHandler {
  constructor(orchestrationEngine) {
    this.orchestrationEngine = orchestrationEngine;
    this.router = Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // GitHub webhook
    this.router.post('/github', 
      this.verifyGitHubSignature.bind(this),
      this.handleGitHubWebhook.bind(this)
    );
    
    // Phoenix monitoring webhook
    this.router.post('/phoenix', 
      this.validatePhoenixWebhook(),
      this.handlePhoenixWebhook.bind(this)
    );
    
    // Generic automation webhook
    this.router.post('/automation', 
      this.validateAutomationWebhook(),
      this.handleAutomationWebhook.bind(this)
    );
    
    // Pipeline status webhook
    this.router.post('/pipeline', 
      this.validatePipelineWebhook(),
      this.handlePipelineWebhook.bind(this)
    );
  }

  // GitHub webhook signature verification
  verifyGitHubSignature(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      return res.status(401).json({ error: 'Unauthorized - missing signature or secret' });
    }
    
    const body = JSON.stringify(req.body);
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return res.status(401).json({ error: 'Unauthorized - invalid signature' });
    }
    
    next();
  }

  // Validation middleware
  validatePhoenixWebhook() {
    return [
      body('type').notEmpty().withMessage('Event type is required'),
      body('data').isObject().withMessage('Event data must be an object')
    ];
  }

  validateAutomationWebhook() {
    return [
      body('trigger').notEmpty().withMessage('Trigger is required'),
      body('instruction').optional().isString().withMessage('Instruction must be a string'),
      body('parameters').optional().isObject().withMessage('Parameters must be an object')
    ];
  }

  validatePipelineWebhook() {
    return [
      body('pipeline_id').notEmpty().withMessage('Pipeline ID is required'),
      body('status').isIn(['started', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
      body('stage').optional().isString().withMessage('Stage must be a string')
    ];
  }

  // GitHub webhook handler
  async handleGitHubWebhook(req, res) {
    try {
      const event = req.headers['x-github-event'];
      const payload = req.body;
      
      console.log(`Received GitHub webhook: ${event}`);
      
      switch (event) {
        case 'push':
          await this.handlePushEvent(payload);
          break;
          
        case 'pull_request':
          await this.handlePullRequestEvent(payload);
          break;
          
        case 'workflow_run':
          await this.handleWorkflowRunEvent(payload);
          break;
          
        case 'issues':
          await this.handleIssuesEvent(payload);
          break;
          
        case 'release':
          await this.handleReleaseEvent(payload);
          break;
          
        default:
          console.log(`Unhandled GitHub event: ${event}`);
      }
      
      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('GitHub webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async handlePushEvent(payload) {
    const { repository, pusher, commits, ref } = payload;
    const branch = ref.replace('refs/heads/', '');
    
    // Skip non-main branch pushes unless configured otherwise
    if (branch !== 'main' && branch !== 'master') {
      console.log(`Ignoring push to ${branch} branch`);
      return;
    }
    
    // Trigger automated workflow for main branch pushes
    const instruction = `Analyze recent commits and run automated tests for repository ${repository.name}. 
Commits: ${commits.map(c => c.message).join(', ')}`;
    
    await this.orchestrationEngine.executeWorkflow(instruction, {
      type: 'ci_cd',
      trigger: 'push',
      repository: repository.name,
      branch,
      pusher: pusher.name,
      commits: commits.length
    });
  }

  async handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;
    
    if (action === 'opened' || action === 'synchronize') {
      // Trigger automated review and testing
      const instruction = `Review pull request #${pull_request.number} in ${repository.name}. 
Title: ${pull_request.title}
Description: ${pull_request.body || 'No description'}`;
      
      await this.orchestrationEngine.executeWorkflow(instruction, {
        type: 'pr_review',
        trigger: action,
        repository: repository.name,
        pr_number: pull_request.number,
        author: pull_request.user.login,
        branch: pull_request.head.ref
      });
    }
  }

  async handleWorkflowRunEvent(payload) {
    const { action, workflow_run, repository } = payload;
    
    if (action === 'completed') {
      const status = workflow_run.conclusion;
      
      if (status === 'failure') {
        // Trigger failure analysis and remediation
        const instruction = `Analyze failed workflow run ${workflow_run.name} in ${repository.name} and suggest remediation steps.`;
        
        await this.orchestrationEngine.executeWorkflow(instruction, {
          type: 'failure_analysis',
          trigger: 'workflow_failure',
          repository: repository.name,
          workflow_name: workflow_run.name,
          run_id: workflow_run.id,
          failure_reason: workflow_run.conclusion
        });
      }
    }
  }

  async handleIssuesEvent(payload) {
    const { action, issue, repository } = payload;
    
    if (action === 'opened') {
      // Analyze new issues and suggest automatic resolution if possible
      const instruction = `Analyze issue #${issue.number} in ${repository.name} and determine if it can be automatically resolved.
Title: ${issue.title}
Description: ${issue.body || 'No description'}`;
      
      await this.orchestrationEngine.executeWorkflow(instruction, {
        type: 'issue_analysis',
        trigger: 'issue_opened',
        repository: repository.name,
        issue_number: issue.number,
        author: issue.user.login,
        labels: issue.labels.map(l => l.name)
      });
    }
  }

  async handleReleaseEvent(payload) {
    const { action, release, repository } = payload;
    
    if (action === 'published') {
      // Trigger deployment workflow
      const instruction = `Deploy release ${release.tag_name} of ${repository.name} to production environment.`;
      
      await this.orchestrationEngine.executeWorkflow(instruction, {
        type: 'deployment',
        trigger: 'release_published',
        repository: repository.name,
        release_tag: release.tag_name,
        release_name: release.name,
        environment: 'production'
      });
    }
  }

  // Phoenix webhook handler
  async handlePhoenixWebhook(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }
      
      const { type, data } = req.body;
      
      console.log(`Received Phoenix webhook: ${type}`);
      
      switch (type) {
        case 'alert':
          await this.handlePhoenixAlert(data);
          break;
          
        case 'metric_threshold':
          await this.handleMetricThreshold(data);
          break;
          
        case 'system_health':
          await this.handleSystemHealth(data);
          break;
          
        default:
          console.log(`Unhandled Phoenix event: ${type}`);
      }
      
      res.status(200).json({ message: 'Phoenix webhook processed' });
    } catch (error) {
      console.error('Phoenix webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async handlePhoenixAlert(data) {
    const { severity, message, workflowId } = data;
    
    if (severity === 'critical') {
      // Trigger automatic remediation
      const instruction = `Handle critical alert: ${message}. Analyze the issue and implement automatic remediation if possible.`;
      
      await this.orchestrationEngine.executeWorkflow(instruction, {
        type: 'incident_response',
        trigger: 'critical_alert',
        alert_data: data,
        priority: 'critical',
        affected_workflow: workflowId
      });
    }
  }

  async handleMetricThreshold(data) {
    const { metric, threshold, current_value } = data;
    
    // Trigger performance optimization workflow
    const instruction = `Optimize system performance: ${metric} has exceeded threshold (${threshold}). Current value: ${current_value}.`;
    
    await this.orchestrationEngine.executeWorkflow(instruction, {
      type: 'performance_optimization',
      trigger: 'metric_threshold',
      metric_data: data
    });
  }

  async handleSystemHealth(data) {
    const { status, components } = data;
    
    if (status === 'degraded' || status === 'down') {
      // Trigger system recovery workflow
      const instruction = `System health is ${status}. Analyze affected components and implement recovery procedures.`;
      
      await this.orchestrationEngine.executeWorkflow(instruction, {
        type: 'system_recovery',
        trigger: 'health_check',
        health_data: data,
        priority: status === 'down' ? 'critical' : 'high'
      });
    }
  }

  // Automation webhook handler
  async handleAutomationWebhook(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }
      
      const { trigger, instruction, parameters = {} } = req.body;
      
      console.log(`Received automation webhook: ${trigger}`);
      
      // Execute workflow based on trigger
      const result = await this.orchestrationEngine.executeWorkflow(
        instruction || `Handle automation trigger: ${trigger}`,
        {
          ...parameters,
          type: 'automation',
          trigger,
          webhook_source: 'external'
        }
      );
      
      res.json({
        message: 'Automation workflow triggered',
        workflowId: result.workflowId,
        success: result.success
      });
    } catch (error) {
      console.error('Automation webhook error:', error);
      res.status(500).json({ error: 'Automation workflow failed' });
    }
  }

  // Pipeline webhook handler
  async handlePipelineWebhook(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }
      
      const { pipeline_id, status, stage, ...data } = req.body;
      
      console.log(`Pipeline ${pipeline_id} status: ${status}`);
      
      // Handle pipeline events
      if (status === 'failed') {
        const instruction = `Analyze failed pipeline ${pipeline_id} at stage ${stage || 'unknown'} and implement recovery procedures.`;
        
        await this.orchestrationEngine.executeWorkflow(instruction, {
          type: 'pipeline_recovery',
          trigger: 'pipeline_failure',
          pipeline_id,
          failed_stage: stage,
          pipeline_data: data
        });
      }
      
      res.json({ message: 'Pipeline webhook processed' });
    } catch (error) {
      console.error('Pipeline webhook error:', error);
      res.status(500).json({ error: 'Pipeline webhook processing failed' });
    }
  }

  getRouter() {
    return this.router;
  }
}