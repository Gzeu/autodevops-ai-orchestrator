#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

class AIDevelopmentAssistant {
  constructor() {
    this.instruction = process.argv.slice(2).join(' ');
  }

  async run() {
    try {
      console.log(chalk.blue('🤖 AI Development Assistant'));
      console.log(chalk.gray('=========================='));
      
      if (!this.instruction) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'instruction',
            message: 'What would you like me to develop?',
            validate: (input) => input.trim().length > 0 || 'Instruction is required'
          }
        ]);
        this.instruction = response.instruction;
      }
      
      console.log(chalk.yellow(`📝 Instruction: ${this.instruction}`));
      
      const plan = await this.createDevelopmentPlan();
      const shouldProceed = await this.confirmPlan(plan);
      
      if (shouldProceed) {
        await this.executePlan(plan);
      } else {
        console.log(chalk.gray('Development cancelled.'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Development failed:'), error.message);
      process.exit(1);
    }
  }

  async createDevelopmentPlan() {
    console.log(chalk.blue('Creating development plan...'));
    
    // Analyze the instruction and create a plan
    const plan = {
      instruction: this.instruction,
      steps: [],
      estimatedTime: 0,
      files: [],
      dependencies: []
    };
    
    // Simple keyword-based planning (in a real implementation, this would use AI)
    const keywords = this.instruction.toLowerCase();
    
    if (keywords.includes('api') || keywords.includes('endpoint')) {
      plan.steps.push({
        type: 'create_api',
        description: 'Create API endpoint',
        files: ['src/routes/api.js'],
        estimatedTime: 15
      });
    }
    
    if (keywords.includes('test') || keywords.includes('testing')) {
      plan.steps.push({
        type: 'create_tests',
        description: 'Create test files',
        files: ['tests/unit/test.js'],
        estimatedTime: 10
      });
    }
    
    if (keywords.includes('database') || keywords.includes('db')) {
      plan.steps.push({
        type: 'setup_database',
        description: 'Setup database integration',
        files: ['src/database/connection.js'],
        dependencies: ['pg', 'mongoose'],
        estimatedTime: 20
      });
    }
    
    if (keywords.includes('authentication') || keywords.includes('auth')) {
      plan.steps.push({
        type: 'setup_auth',
        description: 'Setup authentication system',
        files: ['src/middleware/auth.js', 'src/routes/auth.js'],
        dependencies: ['jsonwebtoken', 'bcrypt'],
        estimatedTime: 25
      });
    }
    
    // Default step if no specific keywords found
    if (plan.steps.length === 0) {
      plan.steps.push({
        type: 'general_development',
        description: 'Implement requested feature',
        files: ['src/features/new-feature.js'],
        estimatedTime: 30
      });
    }
    
    // Calculate totals
    plan.estimatedTime = plan.steps.reduce((total, step) => total + step.estimatedTime, 0);
    plan.files = [...new Set(plan.steps.flatMap(step => step.files || []))];
    plan.dependencies = [...new Set(plan.steps.flatMap(step => step.dependencies || []))];
    
    return plan;
  }

  async confirmPlan(plan) {
    console.log(chalk.green('\n📄 Development Plan:'));
    console.log(chalk.white(`Instruction: ${plan.instruction}`));
    console.log(chalk.white(`Estimated time: ${plan.estimatedTime} minutes`));
    
    console.log(chalk.cyan('\nSteps:'));
    plan.steps.forEach((step, index) => {
      console.log(chalk.white(`  ${index + 1}. ${step.description} (${step.estimatedTime}min)`));
    });
    
    if (plan.files.length > 0) {
      console.log(chalk.cyan('\nFiles to create/modify:'));
      plan.files.forEach(file => {
        console.log(chalk.white(`  - ${file}`));
      });
    }
    
    if (plan.dependencies.length > 0) {
      console.log(chalk.cyan('\nDependencies to install:'));
      plan.dependencies.forEach(dep => {
        console.log(chalk.white(`  - ${dep}`));
      });
    }
    
    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with this plan?',
        default: true
      }
    ]);
    
    return response.proceed;
  }

  async executePlan(plan) {
    console.log(chalk.blue('\n🚀 Executing development plan...'));
    
    for (const [index, step] of plan.steps.entries()) {
      console.log(chalk.yellow(`\nStep ${index + 1}/${plan.steps.length}: ${step.description}`));
      
      try {
        await this.executeStep(step);
        console.log(chalk.green(`✅ Step ${index + 1} completed`));
      } catch (error) {
        console.error(chalk.red(`❌ Step ${index + 1} failed:`), error.message);
        
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continue',
            message: 'Continue with remaining steps?',
            default: false
          }
        ]);
        
        if (!response.continue) {
          break;
        }
      }
    }
    
    console.log(chalk.green('\n✅ Development plan executed!'));
    console.log(chalk.yellow('Don\'t forget to:'));
    console.log('1. Review the generated code');
    console.log('2. Run tests: npm test');
    console.log('3. Commit changes: git add . && git commit -m "AI-generated feature"');
  }

  async executeStep(step) {
    switch (step.type) {
      case 'create_api':
        await this.createAPIEndpoint(step);
        break;
      case 'create_tests':
        await this.createTests(step);
        break;
      case 'setup_database':
        await this.setupDatabase(step);
        break;
      case 'setup_auth':
        await this.setupAuthentication(step);
        break;
      default:
        await this.generalDevelopment(step);
    }
  }

  async createAPIEndpoint(step) {
    const apiCode = `
import { Router } from 'express';

const router = Router();

// GET endpoint
router.get('/', async (req, res) => {
  try {
    // TODO: Implement your logic here
    res.json({ 
      message: 'API endpoint created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    // TODO: Process the data
    res.json({ 
      success: true, 
      data,
      message: 'Data processed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
`;
    
    await this.ensureDirectory('src/routes');
    await fs.writeFile('src/routes/api.js', apiCode.trim());
    console.log(chalk.green('  ✅ API endpoint created'));
  }

  async createTests(step) {
    const testCode = `
import request from 'supertest';
import app from '../src/index.js';

describe('API Tests', () => {
  test('GET / should return success', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body).toHaveProperty('message');
  });
  
  test('POST / should process data', async () => {
    const testData = { test: 'value' };
    
    const response = await request(app)
      .post('/')
      .send(testData)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(testData);
  });
});
`;
    
    await this.ensureDirectory('tests/unit');
    await fs.writeFile('tests/unit/api.test.js', testCode.trim());
    console.log(chalk.green('  ✅ Test files created'));
  }

  async setupDatabase(step) {
    const dbCode = `
import pkg from 'pg';
const { Pool } = pkg;

class Database {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
  }

  async query(text, params) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

export default new Database();
`;
    
    await this.ensureDirectory('src/database');
    await fs.writeFile('src/database/connection.js', dbCode.trim());
    console.log(chalk.green('  ✅ Database setup created'));
  }

  async setupAuthentication(step) {
    const authCode = `
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};
`;
    
    await this.ensureDirectory('src/middleware');
    await fs.writeFile('src/middleware/auth.js', authCode.trim());
    console.log(chalk.green('  ✅ Authentication setup created'));
  }

  async generalDevelopment(step) {
    const featureCode = `
// Generated feature implementation
// TODO: Implement the requested functionality

export class NewFeature {
  constructor() {
    this.name = 'New Feature';
    this.description = '${this.instruction}';
  }

  async execute() {
    // TODO: Implement feature logic
    console.log('Feature executed successfully');
    return {
      success: true,
      message: 'Feature implementation placeholder'
    };
  }
}

export default NewFeature;
`;
    
    await this.ensureDirectory('src/features');
    await fs.writeFile('src/features/new-feature.js', featureCode.trim());
    console.log(chalk.green('  ✅ Feature implementation created'));
  }

  async ensureDirectory(dir) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

const assistant = new AIDevelopmentAssistant();
assistant.run();