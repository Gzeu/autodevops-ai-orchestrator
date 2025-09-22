import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

export class GitHubIntegration {
  constructor({ token, owner, repo }) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Verify GitHub access
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo
      });
      
      this.isInitialized = true;
      console.log('✅ GitHub integration initialized');
    } catch (error) {
      throw new Error(`Failed to initialize GitHub integration: ${error.message}`);
    }
  }

  async analyzeRequirements(instruction, parameters = {}) {
    // Analyze repository structure and existing code
    const analysis = {
      instruction,
      repositoryStructure: await this.getRepositoryStructure(),
      existingFiles: await this.getRelevantFiles(instruction),
      recommendations: []
    };

    // Add recommendations based on analysis
    analysis.recommendations = this.generateRecommendations(analysis);
    
    return analysis;
  }

  async getRepositoryStructure() {
    try {
      const { data: contents } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: ''
      });

      const structure = {};
      for (const item of contents) {
        if (item.type === 'file') {
          structure[item.name] = {
            type: 'file',
            size: item.size,
            path: item.path
          };
        } else if (item.type === 'dir') {
          structure[item.name] = {
            type: 'directory',
            path: item.path
          };
        }
      }

      return structure;
    } catch (error) {
      console.warn('Failed to get repository structure:', error.message);
      return {};
    }
  }

  async getRelevantFiles(instruction) {
    // Get files that might be relevant to the instruction
    const relevantExtensions = ['.js', '.ts', '.json', '.md', '.yml', '.yaml'];
    const files = [];

    try {
      const { data: contents } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: ''
      });

      for (const item of contents) {
        if (item.type === 'file' && relevantExtensions.some(ext => item.name.endsWith(ext))) {
          const fileContent = await this.getFileContent(item.path);
          files.push({
            path: item.path,
            name: item.name,
            content: fileContent,
            size: item.size
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get relevant files:', error.message);
    }

    return files;
  }

  async getFileContent(filePath) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath
      });

      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (error) {
      console.warn(`Failed to get content for ${filePath}:`, error.message);
    }
    
    return null;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Check for package.json
    if (!analysis.repositoryStructure['package.json']) {
      recommendations.push({
        type: 'missing_file',
        description: 'Consider adding package.json for Node.js project configuration',
        priority: 'medium'
      });
    }

    // Check for README
    if (!analysis.repositoryStructure['README.md']) {
      recommendations.push({
        type: 'missing_documentation',
        description: 'Add README.md for project documentation',
        priority: 'high'
      });
    }

    // Check for tests
    const hasTestFiles = analysis.existingFiles.some(file => 
      file.name.includes('test') || file.name.includes('spec')
    );
    
    if (!hasTestFiles) {
      recommendations.push({
        type: 'missing_tests',
        description: 'Consider adding test files for better code quality',
        priority: 'high'
      });
    }

    return recommendations;
  }

  async generateCode(instruction, parameters = {}) {
    // This would integrate with Task Master AI for code generation
    // For now, return a placeholder structure
    return {
      files: parameters.files || [],
      changes: parameters.changes || [],
      newFiles: parameters.newFiles || [],
      instruction
    };
  }

  async commitChanges({ message, files, branch = 'main' }) {
    try {
      // Get the current commit SHA
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`
      });
      
      const currentCommitSha = ref.object.sha;
      
      // Get the current tree
      const { data: currentCommit } = await this.octokit.rest.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: currentCommitSha
      });
      
      const baseTreeSha = currentCommit.tree.sha;
      
      // Create blobs for new/modified files
      const tree = [];
      
      for (const file of files) {
        const { data: blob } = await this.octokit.rest.git.createBlob({
          owner: this.owner,
          repo: this.repo,
          content: file.content,
          encoding: 'utf-8'
        });
        
        tree.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        });
      }
      
      // Create new tree
      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner: this.owner,
        repo: this.repo,
        tree,
        base_tree: baseTreeSha
      });
      
      // Create new commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: newTree.sha,
        parents: [currentCommitSha]
      });
      
      // Update the branch reference
      await this.octokit.rest.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });
      
      return {
        sha: newCommit.sha,
        message: newCommit.message,
        url: newCommit.html_url,
        branch,
        filesChanged: files.length
      };
      
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  async createPullRequest({ title, body, head, base = 'main' }) {
    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head,
        base
      });
      
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state
      };
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  async getWorkflowRuns() {
    try {
      const { data } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner: this.owner,
        repo: this.repo
      });
      
      return data.workflow_runs.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at
      }));
    } catch (error) {
      console.warn('Failed to get workflow runs:', error.message);
      return [];
    }
  }

  async cleanup() {
    // Cleanup resources if needed
    this.isInitialized = false;
  }
}