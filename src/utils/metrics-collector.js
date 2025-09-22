import { performance } from 'perf_hooks';
import os from 'os';

export class MetricsCollector {
  static requests = {
    total: 0,
    successful: 0,
    failed: 0,
    responseTimes: []
  };

  static workflows = {
    total: 0,
    completed: 0,
    failed: 0,
    active: 0
  };

  static system = {
    startTime: Date.now(),
    lastCpuUsage: process.cpuUsage()
  };

  static middleware(req, res, next) {
    const startTime = performance.now();
    
    // Increment total requests
    MetricsCollector.requests.total++;
    
    // Track response
    const originalSend = res.send;
    res.send = function(data) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Record response time
      MetricsCollector.requests.responseTimes.push(responseTime);
      
      // Keep only last 1000 response times
      if (MetricsCollector.requests.responseTimes.length > 1000) {
        MetricsCollector.requests.responseTimes.shift();
      }
      
      // Track success/failure
      if (res.statusCode >= 200 && res.statusCode < 400) {
        MetricsCollector.requests.successful++;
      } else {
        MetricsCollector.requests.failed++;
      }
      
      // Add performance headers
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      
      return originalSend.call(this, data);
    };
    
    next();
  }

  static recordWorkflowStart() {
    MetricsCollector.workflows.total++;
    MetricsCollector.workflows.active++;
  }

  static recordWorkflowComplete(success = true) {
    MetricsCollector.workflows.active--;
    
    if (success) {
      MetricsCollector.workflows.completed++;
    } else {
      MetricsCollector.workflows.failed++;
    }
  }

  static getMetrics() {
    const now = Date.now();
    const uptime = now - MetricsCollector.system.startTime;
    
    // Calculate average response time
    const responseTimes = MetricsCollector.requests.responseTimes;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    // Calculate success rate
    const totalRequests = MetricsCollector.requests.total;
    const successRate = totalRequests > 0 
      ? (MetricsCollector.requests.successful / totalRequests) * 100 
      : 100;
    
    // Calculate workflow success rate
    const totalWorkflows = MetricsCollector.workflows.completed + MetricsCollector.workflows.failed;
    const workflowSuccessRate = totalWorkflows > 0 
      ? (MetricsCollector.workflows.completed / totalWorkflows) * 100 
      : 100;
    
    return {
      timestamp: new Date().toISOString(),
      uptime,
      requests: {
        total: MetricsCollector.requests.total,
        successful: MetricsCollector.requests.successful,
        failed: MetricsCollector.requests.failed,
        successRate,
        averageResponseTime: avgResponseTime,
        requestsPerSecond: totalRequests / (uptime / 1000)
      },
      workflows: {
        total: MetricsCollector.workflows.total,
        completed: MetricsCollector.workflows.completed,
        failed: MetricsCollector.workflows.failed,
        active: MetricsCollector.workflows.active,
        successRate: workflowSuccessRate
      },
      system: MetricsCollector.getSystemMetrics()
    };
  }

  static getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(MetricsCollector.system.lastCpuUsage);
    MetricsCollector.system.lastCpuUsage = process.cpuUsage();
    
    // Convert CPU usage to percentage
    const cpuPercent = {
      user: (cpuUsage.user / 1000000) * 100, // Convert microseconds to percentage
      system: (cpuUsage.system / 1000000) * 100
    };
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuPercent.user,
        system: cpuPercent.system,
        total: cpuPercent.user + cpuPercent.system
      },
      os: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        uptime: os.uptime()
      },
      process: {
        pid: process.pid,
        version: process.version,
        uptime: process.uptime(),
        cwd: process.cwd()
      }
    };
  }

  static reset() {
    MetricsCollector.requests = {
      total: 0,
      successful: 0,
      failed: 0,
      responseTimes: []
    };
    
    MetricsCollector.workflows = {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0
    };
    
    MetricsCollector.system = {
      startTime: Date.now(),
      lastCpuUsage: process.cpuUsage()
    };
  }

  static exportMetrics() {
    return {
      ...MetricsCollector.getMetrics(),
      exportedAt: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }
}