import axios from 'axios';

export class TaskMasterClient {
  constructor({ apiKey, endpoint, model, temperature }) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.model = model;
    this.temperature = temperature;
    this.client = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.client = axios.create({
        baseURL: this.endpoint,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      // Test connection
      await this.testConnection();
      
      this.isInitialized = true;
      console.log('✅ Task Master client initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Task Master client: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const response = await this.client.get('/health');
      if (response.status !== 200) {
        throw new Error('Health check failed');
      }
    } catch (error) {
      // If health endpoint doesn't exist, try a simple completion
      await this.generateCompletion('Test connection', { max_tokens: 1 });
    }
  }

  async analyzeRequirements(instruction, parameters = {}) {
    const prompt = `
As an expert software architect and developer, analyze this development requirement:

"${instruction}"

Provide a detailed analysis including:
1. Technical requirements breakdown
2. Recommended architecture approach
3. Required technologies and dependencies
4. Potential challenges and solutions
5. Estimated complexity and timeline
6. Testing strategy
7. Deployment considerations

Respond in JSON format with structured analysis.
`;

    const response = await this.generateCompletion(prompt, {
      ...parameters,
      temperature: 0.3, // Lower temperature for more structured analysis
      max_tokens: 2000
    });

    try {
      return JSON.parse(response);
    } catch (error) {
      // If JSON parsing fails, return structured text response
      return {
        analysis: response,
        instruction,
        timestamp: new Date().toISOString()
      };
    }
  }

  async generateCode(instruction, parameters = {}) {
    const prompt = `
As an expert developer, generate high-quality code based on this instruction:

"${instruction}"

Requirements:
- Write clean, well-documented code
- Follow best practices and design patterns
- Include error handling where appropriate
- Add relevant comments for complex logic
- Ensure code is production-ready

Additional context:
${parameters.context ? JSON.stringify(parameters.context, null, 2) : 'None'}

Provide the complete code solution.
`;

    const response = await this.generateCompletion(prompt, {
      ...parameters,
      temperature: this.temperature,
      max_tokens: 4000
    });

    // Extract code blocks and file information
    const codeBlocks = this.extractCodeBlocks(response);
    
    return {
      instruction,
      generatedCode: response,
      codeBlocks,
      files: codeBlocks.map(block => ({
        path: block.filename || 'generated-code.js',
        content: block.code,
        language: block.language || 'javascript'
      })),
      timestamp: new Date().toISOString()
    };
  }

  async generatePlan(instruction, parameters = {}) {
    const prompt = `
As a DevOps automation expert, create a detailed workflow plan for this instruction:

"${instruction}"

Create a JSON workflow plan with:
{
  "steps": [
    {
      "id": "unique_step_id",
      "type": "step_type" // analyze, generate_code, run_tests, commit_changes, monitor, deploy
      "description": "What this step does",
      "integration": "required_integration", // github, playwright, phoenix, taskMaster
      "parameters": {}, // Step-specific parameters
      "timeout": 60000, // Timeout in milliseconds
      "retryCount": 2 // Number of retries on failure
    }
  ],
  "estimatedDuration": 300, // Total estimated time in seconds
  "priority": "medium", // low, medium, high, critical
  "dependencies": [], // External dependencies required
  "rollbackStrategy": "automatic" // How to handle failures
}

Ensure the plan is comprehensive and executable.
`;

    const response = await this.generateCompletion(prompt, {
      ...parameters,
      temperature: 0.2, // Lower temperature for structured planning
      max_tokens: 3000
    });

    return response;
  }

  async generateCompletion(prompt, parameters = {}) {
    if (!this.isInitialized) {
      throw new Error('Task Master client not initialized');
    }

    try {
      const requestData = {
        model: this.model,
        prompt,
        temperature: parameters.temperature || this.temperature,
        max_tokens: parameters.max_tokens || 2000,
        top_p: parameters.top_p || 1,
        frequency_penalty: parameters.frequency_penalty || 0,
        presence_penalty: parameters.presence_penalty || 0,
        ...parameters
      };

      const response = await this.client.post('/completions', requestData);
      
      // Handle different response formats from various AI providers
      if (response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].text || response.data.choices[0].message?.content;
      }
      
      if (response.data.text) {
        return response.data.text;
      }
      
      if (response.data.content) {
        return response.data.content;
      }
      
      throw new Error('Unexpected response format from Task Master API');
      
    } catch (error) {
      if (error.response) {
        throw new Error(`Task Master API error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      }
      throw new Error(`Task Master request failed: ${error.message}`);
    }
  }

  extractCodeBlocks(text) {
    const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        filename: this.inferFilename(match[1], match[2])
      });
    }

    return blocks;
  }

  inferFilename(language, code) {
    const extensions = {
      javascript: '.js',
      typescript: '.ts',
      python: '.py',
      java: '.java',
      cpp: '.cpp',
      c: '.c',
      html: '.html',
      css: '.css',
      json: '.json',
      yaml: '.yml',
      dockerfile: 'Dockerfile',
      bash: '.sh',
      sql: '.sql'
    };

    // Try to extract filename from code comments
    const filenameMatch = code.match(/\/\/\s*(?:filename:|file:)\s*([^\n]+)/i) ||
                         code.match(/#\s*(?:filename:|file:)\s*([^\n]+)/i);
    
    if (filenameMatch) {
      return filenameMatch[1].trim();
    }

    const extension = extensions[language?.toLowerCase()] || '.txt';
    return `generated-code${extension}`;
  }

  async cleanup() {
    this.isInitialized = false;
    this.client = null;
  }
}