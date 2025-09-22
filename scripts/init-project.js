#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

class ProjectInitializer {
  constructor() {
    this.projectName = process.argv[2] || 'new-project';
    this.baseDir = process.cwd();
  }

  async run() {
    try {
      console.log(chalk.blue('🚀 AutoDevOps AI Orchestrator - Project Initializer'));
      console.log(chalk.gray('====================================='));
      
      const config = await this.promptConfiguration();
      await this.createProjectStructure(config);
      await this.setupGitRepository(config);
      await this.createInitialFiles(config);
      
      console.log(chalk.green('✅ Project initialized successfully!'));
      console.log(chalk.yellow('Next steps:'));
      console.log('1. Configure your .env file with API keys');
      console.log('2. Run: npm install');
      console.log('3. Run: npm start');
      
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error.message);
      process.exit(1);
    }
  }

  async promptConfiguration() {
    const questions = [
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: this.projectName,
        validate: (input) => input.trim().length > 0 || 'Project name is required'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'AI-powered DevOps automation project'
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'Project type:',
        choices: [
          { name: 'Web Application', value: 'web' },
          { name: 'API Service', value: 'api' },
          { name: 'CLI Tool', value: 'cli' },
          { name: 'Library', value: 'library' }
        ]
      },
      {
        type: 'checkbox',
        name: 'integrations',
        message: 'Select integrations to configure:',
        choices: [
          { name: 'GitHub API', value: 'github', checked: true },
          { name: 'Task Master AI', value: 'taskmaster', checked: true },
          { name: 'FastMCP', value: 'fastmcp', checked: true },
          { name: 'Playwright Testing', value: 'playwright', checked: true },
          { name: 'Phoenix Monitoring', value: 'phoenix', checked: true }
        ]
      },
      {
        type: 'confirm',
        name: 'setupGit',
        message: 'Initialize Git repository?',
        default: true
      },
      {
        type: 'confirm',
        name: 'createDocumentation',
        message: 'Generate documentation?',
        default: true
      }
    ];

    return await inquirer.prompt(questions);
  }

  async createProjectStructure(config) {
    const projectDir = path.join(this.baseDir, config.projectName);
    
    console.log(chalk.blue('Creating project structure...'));
    
    const directories = [
      'src',
      'src/core',
      'src/integrations',
      'src/routes',
      'src/handlers',
      'src/utils',
      'src/middleware',
      'tests',
      'tests/unit',
      'tests/integration',
      'docs',
      'scripts',
      'config',
      'logs'
    ];

    await fs.mkdir(projectDir, { recursive: true });
    
    for (const dir of directories) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }
    
    this.projectDir = projectDir;
    console.log(chalk.green(`✅ Created project directory: ${projectDir}`));
  }

  async setupGitRepository(config) {
    if (!config.setupGit) return;
    
    console.log(chalk.blue('Setting up Git repository...'));
    
    try {
      process.chdir(this.projectDir);
      execSync('git init', { stdio: 'pipe' });
      
      // Create .gitignore
      const gitignore = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Test results
test-results/
playwright-report/
test-output/

# Build outputs
dist/
build/
`;
      
      await fs.writeFile(path.join(this.projectDir, '.gitignore'), gitignore.trim());
      console.log(chalk.green('✅ Git repository initialized'));
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to setup Git repository:'), error.message);
    }
  }

  async createInitialFiles(config) {
    console.log(chalk.blue('Creating initial files...'));
    
    // Create package.json
    await this.createPackageJson(config);
    
    // Create basic source files
    await this.createSourceFiles(config);
    
    // Create configuration files
    await this.createConfigFiles(config);
    
    // Create documentation
    if (config.createDocumentation) {
      await this.createDocumentation(config);
    }
    
    console.log(chalk.green('✅ Initial files created'));
  }

  async createPackageJson(config) {
    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: config.description,
      main: 'src/index.js',
      type: 'module',
      scripts: {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js',
        test: 'jest',
        lint: 'eslint src/',
        build: 'npm run lint && npm run test'
      },
      keywords: ['ai', 'devops', 'automation', 'orchestration'],
      author: process.env.USER || 'developer',
      license: 'MIT',
      dependencies: {
        express: '^4.18.2',
        dotenv: '^16.3.1',
        winston: '^3.11.0',
        ...(config.integrations.includes('github') && { '@octokit/rest': '^20.0.2' }),
        ...(config.integrations.includes('playwright') && { '@playwright/test': '^1.40.0' }),
        ...(config.integrations.includes('fastmcp') && { ws: '^8.14.2' })
      },
      devDependencies: {
        nodemon: '^3.0.2',
        jest: '^29.7.0',
        eslint: '^8.55.0'
      }
    };
    
    await fs.writeFile(
      path.join(this.projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  async createSourceFiles(config) {
    // Create basic index.js
    const indexJs = `
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: '${config.projectName}',
    description: '${config.description}',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;
    
    await fs.writeFile(path.join(this.projectDir, 'src/index.js'), indexJs.trim());
  }

  async createConfigFiles(config) {
    // Create .env.example
    const envExample = `
# Server Configuration
PORT=3000
NODE_ENV=development

# GitHub Configuration
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo

# Task Master Configuration
TASK_MASTER_API_KEY=your_taskmaster_key
TASK_MASTER_ENDPOINT=https://api.taskmaster.ai/v1

# FastMCP Configuration
MCP_HOST=localhost
MCP_PORT=3000

# Playwright Configuration
PLAYWRIGHT_HEADLESS=true

# Phoenix Configuration
PHOENIX_ENDPOINT=your_phoenix_endpoint
PHOENIX_API_KEY=your_phoenix_key
`;
    
    await fs.writeFile(path.join(this.projectDir, '.env.example'), envExample.trim());
  }

  async createDocumentation(config) {
    const readme = `
# ${config.projectName}

${config.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

1. Copy \`.env.example\` to \`.env\`
2. Fill in your configuration values

## Usage

\`\`\`bash
# Development
npm run dev

# Production
npm start

# Testing
npm test
\`\`\`

## Project Structure

\`\`\`
src/
├── core/          # Core orchestration logic
├── integrations/  # External service integrations
├── routes/        # API routes
├── handlers/      # Webhook and event handlers
├── utils/         # Utility functions
└── index.js       # Application entry point
\`\`\`

## Features

${config.integrations.map(integration => `- ${integration} integration`).join('\n')}

## License

MIT
`;
    
    await fs.writeFile(path.join(this.projectDir, 'README.md'), readme.trim());
  }
}

const initializer = new ProjectInitializer();
initializer.run();