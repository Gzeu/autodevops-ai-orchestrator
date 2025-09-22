import axios from 'axios';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';

export class PhoenixMonitor extends EventEmitter {
  constructor({ endpoint, apiKey, webhookUrl, metricsInterval }) {
    super();
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.webhookUrl = webhookUrl;
    this.metricsInterval = metricsInterval || 30000; // 30 seconds
    this.client = null;
    this.isInitialized = false;
    this.isMonitoring = false;
    this.metrics = {
      workflows: new Map(),
      system: {
        cpu: [],
        memory: [],
        uptime: []
      },
      performance: {
        responseTime: [],
        throughput: [],
        errorRate: []
      }
    };
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.client = axios.create({
        baseURL: this.endpoint,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      // Test connection
      await this.testConnection();
      
      // Start monitoring
      await this.startMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Phoenix monitor initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Phoenix monitor: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const response = await this.client.get('/health');
      if (response.status !== 200) {
        throw new Error('Health check failed');
      }
    } catch (error) {
      // If Phoenix doesn't have a health endpoint, try creating a basic metric
      await this.sendMetric('connection_test', 1, { test: true });
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Collect and send metrics periodically
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAndSendMetrics();
      } catch (error) {
        console.warn('Failed to collect metrics:', error.message);
      }
    }, this.metricsInterval);
    
    console.log('Phoenix monitoring started');
  }

  async stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Phoenix monitoring stopped');
  }

  async collectAndSendMetrics() {
    const timestamp = new Date().toISOString();
    
    // Collect system metrics
    const systemMetrics = this.collectSystemMetrics();
    
    // Send system metrics
    await this.sendMetric('system.cpu_usage', systemMetrics.cpuUsage, { timestamp });
    await this.sendMetric('system.memory_usage', systemMetrics.memoryUsage, { timestamp });
    await this.sendMetric('system.uptime', systemMetrics.uptime, { timestamp });
    
    // Send application metrics
    const appMetrics = this.getApplicationMetrics();
    await this.sendMetric('app.active_workflows', appMetrics.activeWorkflows, { timestamp });
    await this.sendMetric('app.total_workflows', appMetrics.totalWorkflows, { timestamp });
    await this.sendMetric('app.success_rate', appMetrics.successRate, { timestamp });
    
    // Store metrics locally
    this.storeMetrics(systemMetrics, appMetrics, timestamp);
  }

  collectSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    return {
      cpuUsage,
      memoryUsage,
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      totalMemory: totalMem,
      freeMemory: freeMem
    };
  }

  getApplicationMetrics() {
    return {
      activeWorkflows: this.metrics.workflows.size,
      totalWorkflows: Array.from(this.metrics.workflows.values())
        .reduce((total, workflow) => total + (workflow.completed || 0), 0),
      successRate: this.calculateSuccessRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate()
    };
  }

  calculateSuccessRate() {
    const workflows = Array.from(this.metrics.workflows.values());
    if (workflows.length === 0) return 100;
    
    const successful = workflows.filter(w => w.status === 'completed').length;
    return (successful / workflows.length) * 100;
  }

  calculateAverageResponseTime() {
    const responseTimes = this.metrics.performance.responseTime;
    if (responseTimes.length === 0) return 0;
    
    const sum = responseTimes.reduce((total, time) => total + time, 0);
    return sum / responseTimes.length;
  }

  calculateErrorRate() {
    const errorRates = this.metrics.performance.errorRate;
    if (errorRates.length === 0) return 0;
    
    const sum = errorRates.reduce((total, rate) => total + rate, 0);
    return sum / errorRates.length;
  }

  storeMetrics(systemMetrics, appMetrics, timestamp) {
    // Store system metrics (keep last 100 entries)
    this.metrics.system.cpu.push({ value: systemMetrics.cpuUsage, timestamp });
    this.metrics.system.memory.push({ value: systemMetrics.memoryUsage, timestamp });
    this.metrics.system.uptime.push({ value: systemMetrics.uptime, timestamp });
    
    // Trim arrays to prevent memory leaks
    if (this.metrics.system.cpu.length > 100) this.metrics.system.cpu.shift();
    if (this.metrics.system.memory.length > 100) this.metrics.system.memory.shift();
    if (this.metrics.system.uptime.length > 100) this.metrics.system.uptime.shift();
  }

  async sendMetric(name, value, tags = {}) {
    try {
      const metric = {
        name,
        value,
        tags: {
          service: 'autodevops-orchestrator',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          ...tags
        },
        timestamp: new Date().toISOString()
      };
      
      await this.client.post('/metrics', metric);
    } catch (error) {
      console.warn(`Failed to send metric ${name}:`, error.message);
    }
  }

  async setupMonitoring(workflowId, parameters = {}) {
    const monitoringConfig = {
      workflowId,
      alerts: parameters.alerts || [],
      thresholds: parameters.thresholds || {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        memoryUsage: 80 // 80%
      },
      notifications: parameters.notifications || {
        slack: this.webhookUrl,
        email: parameters.email
      },
      dashboards: parameters.dashboards || ['overview', 'performance', 'errors']
    };
    
    // Create monitoring setup for workflow
    this.metrics.workflows.set(workflowId, {
      id: workflowId,
      status: 'monitoring',
      startTime: new Date().toISOString(),
      config: monitoringConfig,
      metrics: {
        executionTime: [],
        errors: [],
        steps: []
      }
    });
    
    // Send monitoring setup to Phoenix
    await this.sendEvent('monitoring.workflow_started', {
      workflowId,
      config: monitoringConfig
    });
    
    return monitoringConfig;
  }

  async trackWorkflowStep(workflowId, stepId, status, metrics = {}) {
    const workflow = this.metrics.workflows.get(workflowId);
    if (!workflow) {
      console.warn(`Workflow ${workflowId} not found in monitoring`);
      return;
    }
    
    const stepMetrics = {
      stepId,
      status,
      timestamp: new Date().toISOString(),
      duration: metrics.duration || 0,
      ...metrics
    };
    
    workflow.metrics.steps.push(stepMetrics);
    
    // Send step tracking event
    await this.sendEvent('monitoring.workflow_step', {
      workflowId,
      step: stepMetrics
    });
    
    // Check for alerts
    await this.checkAlerts(workflowId, stepMetrics);
  }

  async trackWorkflowCompletion(workflowId, result) {
    const workflow = this.metrics.workflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = result.status;
    workflow.endTime = new Date().toISOString();
    workflow.duration = new Date(workflow.endTime) - new Date(workflow.startTime);
    workflow.result = result;
    
    // Calculate workflow metrics
    const workflowMetrics = {
      duration: workflow.duration,
      stepCount: workflow.metrics.steps.length,
      errorCount: workflow.metrics.errors.length,
      successRate: result.status === 'completed' ? 100 : 0
    };
    
    // Send completion event
    await this.sendEvent('monitoring.workflow_completed', {
      workflowId,
      metrics: workflowMetrics,
      result
    });
    
    // Store performance metrics
    this.metrics.performance.responseTime.push(workflow.duration);
    this.metrics.performance.errorRate.push(workflowMetrics.errorCount / workflowMetrics.stepCount);
    
    // Clean up old workflow data
    setTimeout(() => {
      this.metrics.workflows.delete(workflowId);
    }, 5 * 60 * 1000); // Keep for 5 minutes
  }

  async sendEvent(eventType, data) {
    try {
      const event = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
        service: 'autodevops-orchestrator'
      };
      
      await this.client.post('/events', event);
    } catch (error) {
      console.warn(`Failed to send event ${eventType}:`, error.message);
    }
  }

  async checkAlerts(workflowId, metrics) {
    const workflow = this.metrics.workflows.get(workflowId);
    if (!workflow || !workflow.config.thresholds) return;
    
    const { thresholds } = workflow.config;
    const alerts = [];
    
    // Check response time threshold
    if (metrics.duration && metrics.duration > thresholds.responseTime) {
      alerts.push({
        type: 'performance',
        level: 'warning',
        message: `Step ${metrics.stepId} exceeded response time threshold`,
        threshold: thresholds.responseTime,
        actual: metrics.duration
      });
    }
    
    // Check error rate
    const errorRate = workflow.metrics.errors.length / workflow.metrics.steps.length;
    if (errorRate > thresholds.errorRate) {
      alerts.push({
        type: 'reliability',
        level: 'critical',
        message: `Workflow ${workflowId} error rate exceeded threshold`,
        threshold: thresholds.errorRate,
        actual: errorRate
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(workflowId, alert);
    }
  }

  async sendAlert(workflowId, alert) {
    // Send alert to Phoenix
    await this.sendEvent('monitoring.alert', {
      workflowId,
      alert
    });
    
    // Send webhook notification if configured
    if (this.webhookUrl) {
      try {
        await axios.post(this.webhookUrl, {
          text: `Alert: ${alert.message}`,
          workflowId,
          alert,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to send webhook alert:', error.message);
      }
    }
    
    this.emit('alert', { workflowId, alert });
  }

  getDashboardData() {
    return {
      system: {
        cpu: this.metrics.system.cpu.slice(-20), // Last 20 entries
        memory: this.metrics.system.memory.slice(-20),
        uptime: process.uptime()
      },
      workflows: {
        active: this.metrics.workflows.size,
        recent: Array.from(this.metrics.workflows.values()).slice(-10)
      },
      performance: {
        averageResponseTime: this.calculateAverageResponseTime(),
        successRate: this.calculateSuccessRate(),
        errorRate: this.calculateErrorRate()
      }
    };
  }

  async cleanup() {
    await this.stopMonitoring();
    this.metrics.workflows.clear();
    this.isInitialized = false;
  }
}