import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class FastMCPBridge extends EventEmitter {
  constructor({ host, port, protocol, authToken }) {
    super();
    this.host = host;
    this.port = port;
    this.protocol = protocol;
    this.authToken = authToken;
    this.ws = null;
    this.isConnected = false;
    this.pendingRequests = new Map();
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  async initialize() {
    try {
      await this.connect();
      console.log('✅ FastMCP bridge initialized');
    } catch (error) {
      throw new Error(`Failed to initialize FastMCP bridge: ${error.message}`);
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.protocol}://${this.host}:${this.port}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`
        } : undefined
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.emit('disconnected', { code, reason: reason.toString() });
        
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        if (!this.isConnected) {
          reject(error);
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          this.ws.terminate();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  scheduleReconnect() {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.warn('FastMCP reconnection failed:', error.message);
      }
    }, delay);
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.id && this.pendingRequests.has(message.id)) {
        // Handle response to a request
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message || 'MCP request failed'));
        } else {
          resolve(message.result);
        }
      } else if (message.method) {
        // Handle incoming notification or request
        this.emit('message', message);
        
        if (message.method === 'notification' && message.params) {
          this.handleNotification(message.params);
        }
      }
    } catch (error) {
      console.error('Failed to parse MCP message:', error);
    }
  }

  handleNotification(params) {
    const { channel, data } = params;
    
    if (this.subscriptions.has(channel)) {
      const callbacks = this.subscriptions.get(channel);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in notification callback:', error);
        }
      });
    }
    
    this.emit('notification', { channel, data });
  }

  async sendRequest(method, params = {}, timeout = 30000) {
    if (!this.isConnected) {
      throw new Error('FastMCP bridge not connected');
    }

    const id = uuidv4();
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  sendNotification(method, params = {}) {
    if (!this.isConnected) {
      throw new Error('FastMCP bridge not connected');
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.ws.send(JSON.stringify(message));
  }

  subscribe(channel, callback) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      
      // Send subscription request
      this.sendNotification('subscribe', { channel });
    }
    
    this.subscriptions.get(channel).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          this.sendNotification('unsubscribe', { channel });
        }
      }
    };
  }

  // Integration-specific methods
  async broadcastWorkflowStatus(workflowId, status) {
    return this.sendRequest('workflow.broadcast_status', {
      workflowId,
      status,
      timestamp: new Date().toISOString()
    });
  }

  async requestCodeReview(code, context = {}) {
    return this.sendRequest('code.request_review', {
      code,
      context,
      requestId: uuidv4()
    });
  }

  async shareTestResults(results) {
    return this.sendRequest('test.share_results', {
      results,
      timestamp: new Date().toISOString()
    });
  }

  async syncMetrics(metrics) {
    this.sendNotification('metrics.sync', {
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      pendingRequests: this.pendingRequests.size,
      subscriptions: Array.from(this.subscriptions.keys())
    };
  }

  async cleanup() {
    this.isConnected = false;
    this.pendingRequests.clear();
    this.subscriptions.clear();
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }
}