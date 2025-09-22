# Contributing to AutoDevOps AI Orchestrator

Thank you for your interest in contributing to AutoDevOps AI Orchestrator! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and professional in all interactions.

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for local development)
- Git

### Setup Steps

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/autodevops-ai-orchestrator.git
   cd autodevops-ai-orchestrator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development environment**
   ```bash
   # Option 1: Local development
   npm run dev
   
   # Option 2: Docker development
   docker-compose up -d
   ```

5. **Run tests**
   ```bash
   npm test
   npm run test:coverage
   ```

## Project Structure

```
src/
├── core/
│   ├── orchestration-engine.js    # Main orchestration logic
│   ├── workflow-executor.js       # Workflow execution engine
│   ├── task-queue.js             # Task queue management
│   └── state-manager.js          # Application state management
├── integrations/
│   ├── github-integration.js     # GitHub API integration
│   ├── taskmaster-client.js      # Task Master AI client
│   ├── fastmcp-bridge.js         # FastMCP communication
│   ├── playwright-runner.js      # Playwright test runner
│   └── phoenix-monitor.js        # Phoenix monitoring
├── routes/
│   └── api-routes.js             # REST API routes
├── handlers/
│   └── webhook-handler.js        # Webhook event handlers
├── utils/
│   ├── error-handler.js          # Error handling utilities
│   └── metrics-collector.js      # Metrics collection
└── index.js                   # Application entry point
```

## Contributing Guidelines

### Code Style

- Use ES6+ features and modules
- Follow existing code formatting (use Prettier)
- Add JSDoc comments for public methods
- Use meaningful variable and function names
- Keep functions focused and small

### Testing

- Write unit tests for new functionality
- Maintain test coverage above 80%
- Add integration tests for API endpoints
- Use Playwright for E2E testing
- Mock external services in tests

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes**
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run lint
   npm test
   npm run test:coverage
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commits:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for refactoring
   - `chore:` for maintenance

5. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```
   
   Then create a Pull Request on GitHub.

### Integration Development

When adding new integrations:

1. Create a new file in `src/integrations/`
2. Implement the integration interface:
   ```javascript
   export class YourIntegration {
     constructor(config) { /* ... */ }
     async initialize() { /* ... */ }
     async cleanup() { /* ... */ }
     // Integration-specific methods
   }
   ```
3. Add configuration options to `.env.example`
4. Update the main orchestration engine
5. Add comprehensive tests
6. Update documentation

### API Development

- Follow RESTful conventions
- Use appropriate HTTP status codes
- Implement proper error handling
- Add input validation
- Document endpoints with examples
- Include rate limiting considerations

### Monitoring and Observability

- Add relevant metrics for new features
- Implement proper logging
- Include performance monitoring
- Add health checks for new services
- Consider alerting requirements

## Issue Reporting

When reporting issues:

1. **Check existing issues** first
2. **Use issue templates** when available
3. **Provide detailed information**:
   - Environment details (OS, Node.js version, etc.)
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs or error messages
   - Screenshots if applicable

## Feature Requests

For feature requests:

1. Check if the feature already exists or is planned
2. Describe the use case and benefits
3. Provide examples or mockups if applicable
4. Consider implementation complexity
5. Be open to discussion and feedback

## Documentation

When updating documentation:

- Keep it clear and concise
- Include practical examples
- Update both README and inline documentation
- Verify all links work
- Use proper markdown formatting

## Release Process

1. All changes go through pull request review
2. Automated tests must pass
3. Security scanning must pass
4. Manual testing for major features
5. Version bumping follows semantic versioning
6. Release notes are automatically generated

## Community

- Join our discussions in GitHub Issues
- Share your use cases and experiences
- Help others with questions and problems
- Contribute to documentation and examples

## Questions?

If you have questions about contributing, please:

1. Check this document first
2. Search existing issues and discussions
3. Create a new issue with the "question" label
4. Reach out to maintainers if needed

Thank you for contributing to AutoDevOps AI Orchestrator! 🚀