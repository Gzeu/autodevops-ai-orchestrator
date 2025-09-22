#!/usr/bin/env node

import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import winston from 'winston';
import chalk from 'chalk';

// Import core modules
import { OrchestrationEngine } from './core/orchestration-engine.js';
import { GitHubIntegration } from './integrations/github-integration.js';
import { TaskMasterClient } from './integrations/taskmaster-client.js';
import { FastMCPBridge } from './integrations/fastmcp-bridge.js';
import { PlaywrightTestRunner } from './integrations/playwright-runner.js';
import { PhoenixMonitor } from './integrations/phoenix-monitor.js';
import { WebhookHandler } from './handlers/webhook-handler.js';
import { APIRoutes } from './routes/api-routes.js';
import { ErrorHandler } from './utils/error-handler.js';
import { MetricsCollector } from './utils/metrics-collector.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level}]: ${stack || message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

class AutoDevOpsOrchestrator {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.orchestrationEngine = null;
    this.integrations = {};
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      logger.info(chalk.blue('🚀 Initializing AutoDevOps AI Orchestrator...'));

      // Initialize core components
      await this.initializeIntegrations();
      await this.initializeOrchestrationEngine();
      await this.setupMiddleware();
      await this.setupRoutes();
      await this.setupWebSocket();
      await this.setupErrorHandling();

      logger.info(chalk.green('✅ Initialization completed successfully'));
    } catch (error) {
      logger.error(chalk.red('❌ Initialization failed:'), error);
      process.exit(1);
    }
  }

  async initializeIntegrations() {
    logger.info('Initializing integrations...');

    // Initialize GitHub integration
    this.integrations.github = new GitHubIntegration({
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO
    });

    // Initialize Task Master client
    this.integrations.taskMaster = new TaskMasterClient({
      apiKey: process.env.TASK_MASTER_API_KEY,
      endpoint: process.env.TASK_MASTER_ENDPOINT,
      model: process.env.AI_MODEL,
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
    });

    // Initialize FastMCP bridge
    this.integrations.fastMCP = new FastMCPBridge({
      host: process.env.MCP_HOST,
      port: parseInt(process.env.MCP_PORT),
      protocol: process.env.MCP_PROTOCOL,
      authToken: process.env.MCP_AUTH_TOKEN
    });

    // Initialize Playwright test runner
    this.integrations.playwright = new PlaywrightTestRunner({
      headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
      browser: process.env.PLAYWRIGHT_BROWSER,
      timeout: parseInt(process.env.TEST_TIMEOUT),
      retryCount: parseInt(process.env.TEST_RETRY_COUNT)
    });

    // Initialize Phoenix monitor
    this.integrations.phoenix = new PhoenixMonitor({
      endpoint: process.env.PHOENIX_ENDPOINT,
      apiKey: process.env.PHOENIX_API_KEY,
      webhookUrl: process.env.MONITORING_WEBHOOK,
      metricsInterval: parseInt(process.env.METRICS_INTERVAL)
    });

    // Initialize all integrations
    await Promise.all([
      this.integrations.github.initialize(),
      this.integrations.taskMaster.initialize(),
      this.integrations.fastMCP.initialize(),
      this.integrations.playwright.initialize(),
      this.integrations.phoenix.initialize()
    ]);

    logger.info(chalk.green('✅ All integrations initialized'));
  }

  async initializeOrchestrationEngine() {
    logger.info('Initializing orchestration engine...');
    
    this.orchestrationEngine = new OrchestrationEngine({
      integrations: this.integrations,
      logger
    });

    await this.orchestrationEngine.initialize();
    logger.info(chalk.green('✅ Orchestration engine ready'));
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Metrics collection
    this.app.use(MetricsCollector.middleware);
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
      });
    });

    // Webhook endpoints
    const webhookHandler = new WebhookHandler(this.orchestrationEngine);
    this.app.use('/webhook', webhookHandler.getRouter());

    // API routes
    const apiRoutes = new APIRoutes(this.orchestrationEngine);
    this.app.use('/api', apiRoutes.getRouter());

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'AutoDevOps AI Orchestrator',
        description: 'AI-powered end-to-end DevOps automation platform',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
          health: '/health',
          api: '/api',
          webhook: '/webhook',
          websocket: '/ws'
        }
      });
    });
  }

  setupWebSocket() {
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws, request) => {
      logger.info(`WebSocket client connected: ${request.socket.remoteAddress}`);
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          const response = await this.orchestrationEngine.handleWebSocketMessage(data);
          ws.send(JSON.stringify(response));
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });
    });
  }

  setupErrorHandling() {
    this.app.use(ErrorHandler.middleware);

    // Global error handlers
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('SIGTERM');
    });

    // Graceful shutdown handlers
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  async start() {
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || 'localhost';

    this.server.listen(port, host, () => {
      logger.info(chalk.green(`🎉 AutoDevOps AI Orchestrator is running!`));
      logger.info(chalk.blue(`📡 Server: http://${host}:${port}`));
      logger.info(chalk.blue(`🔌 WebSocket: ws://${host}:${port}/ws`));
      logger.info(chalk.yellow('Ready to orchestrate your DevOps workflows! 🤖'));
    });
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(chalk.yellow(`Received ${signal}. Starting graceful shutdown...`));

    try {
      // Close WebSocket connections
      if (this.wss) {
        this.wss.clients.forEach(client => client.terminate());
        this.wss.close();
      }

      // Close server
      if (this.server) {
        this.server.close();
      }

      // Cleanup integrations
      if (this.integrations) {
        await Promise.all([
          this.integrations.github?.cleanup(),
          this.integrations.taskMaster?.cleanup(),
          this.integrations.fastMCP?.cleanup(),
          this.integrations.playwright?.cleanup(),
          this.integrations.phoenix?.cleanup()
        ]);
      }

      logger.info(chalk.green('✅ Graceful shutdown completed'));
      process.exit(0);
    } catch (error) {
      logger.error(chalk.red('❌ Error during shutdown:'), error);
      process.exit(1);
    }
  }
}

// Start the application
const orchestrator = new AutoDevOpsOrchestrator();

(async () => {
  try {
    await orchestrator.initialize();
    await orchestrator.start();
  } catch (error) {
    logger.error(chalk.red('Failed to start application:'), error);
    process.exit(1);
  }
})();