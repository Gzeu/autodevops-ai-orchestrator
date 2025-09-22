export class StateManager {
  constructor() {
    this.workflows = new Map();
    this.metrics = {
      totalWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      averageDuration: 0
    };
  }

  async initialize() {
    // Initialize state management
    // Could load from database or file system
  }

  saveWorkflowState(workflowId, state) {
    this.workflows.set(workflowId, {
      ...state,
      lastUpdated: new Date().toISOString()
    });
  }

  getWorkflowState(workflowId) {
    return this.workflows.get(workflowId);
  }

  updateMetrics(workflow) {
    this.metrics.totalWorkflows++;
    
    if (workflow.status === 'completed') {
      this.metrics.completedWorkflows++;
    } else if (workflow.status === 'failed') {
      this.metrics.failedWorkflows++;
    }
    
    // Calculate average duration
    if (workflow.completedAt && workflow.createdAt) {
      const duration = new Date(workflow.completedAt) - new Date(workflow.createdAt);
      this.metrics.averageDuration = (
        (this.metrics.averageDuration * (this.metrics.totalWorkflows - 1) + duration) /
        this.metrics.totalWorkflows
      );
    }
  }

  getTotalWorkflows() {
    return this.metrics.totalWorkflows;
  }

  getSuccessRate() {
    if (this.metrics.totalWorkflows === 0) return 0;
    return this.metrics.completedWorkflows / this.metrics.totalWorkflows;
  }

  getAverageDuration() {
    return this.metrics.averageDuration;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  cleanup() {
    // Cleanup old workflow states
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    for (const [workflowId, workflow] of this.workflows) {
      if (new Date(workflow.lastUpdated) < cutoff) {
        this.workflows.delete(workflowId);
      }
    }
  }
}