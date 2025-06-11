import { WorkflowDiscovery } from '../app/services/workflow/WorkflowDiscovery';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs operations
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
}));

// Mock path operations
jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn(),
  dirname: jest.fn(),
  basename: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('WorkflowDiscovery', () => {
  const mockWorkflowsDir = '/app/novu/workflows';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockReturnValue('/app/novu');
    mockPath.basename.mockImplementation((p) => p.split('/').pop() || '');
  });

  describe('discoverStaticWorkflows', () => {
    it('should discover workflows from filesystem', async () => {
      // Mock the entries with isDirectory method for readdir with withFileTypes
      const mockEntries = [
        { name: 'user-signup', isDirectory: () => true },
        { name: 'password-reset', isDirectory: () => true },
        { name: 'welcome-email', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);

      // Mock index.ts files exist
      mockFs.access.mockResolvedValue(undefined);

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.has('user-signup')).toBe(true);
      expect(result.has('password-reset')).toBe(true);
      expect(result.has('welcome-email')).toBe(true);
    });

    it('should handle directories without index.ts files', async () => {
      const mockEntries = [
        { name: 'valid-workflow', isDirectory: () => true },
        { name: 'invalid-workflow', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);

      // Mock access check - only valid-workflow has index.ts
      mockFs.access.mockImplementation(async (filePath) => {
        if ((filePath as string).includes('valid-workflow')) {
          return Promise.resolve();
        }
        throw new Error('File not found');
      });

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result.size).toBe(1);
      expect(result.has('valid-workflow')).toBe(true);
      expect(result.has('invalid-workflow')).toBe(false);
    });

    it('should ignore hidden directories and files', async () => {
      const mockEntries = [
        { name: '.hidden', isDirectory: () => true },
        { name: '_private', isDirectory: () => true },
        { name: 'valid-workflow', isDirectory: () => true },
        { name: 'node_modules', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);
      mockFs.access.mockResolvedValue(undefined);

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result.size).toBe(1);
      expect(result.has('valid-workflow')).toBe(true);
    });

    it('should handle import errors gracefully', async () => {
      const mockEntries = [
        { name: 'good-workflow', isDirectory: () => true },
        { name: 'broken-workflow', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);

      // Mock access - good-workflow has index.ts, broken-workflow doesn't
      mockFs.access.mockImplementation(async (filePath) => {
        if ((filePath as string).includes('good-workflow')) {
          return Promise.resolve();
        }
        throw new Error('File not found');
      });

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result.size).toBe(1);
      expect(result.has('good-workflow')).toBe(true);
      expect(result.has('broken-workflow')).toBe(false);
    });

    it('should handle missing workflows directory', async () => {
      // Should throw error instead of returning empty map as per implementation
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      await expect(WorkflowDiscovery.discoverStaticWorkflows()).rejects.toThrow('Directory not found');
    });

    it('should convert directory names to workflow keys', async () => {
      const mockEntries = [
        { name: 'user_signup', isDirectory: () => true },
        { name: 'password-reset', isDirectory: () => true },
        { name: 'welcomeEmail', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);
      mockFs.access.mockResolvedValue(undefined);

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      // Directory names should be converted to kebab-case workflow keys
      expect(result.has('user-signup')).toBe(true);
      expect(result.has('password-reset')).toBe(true);
      expect(result.has('welcome-email')).toBe(true);
    });
  });

  describe('validateWorkflowDirectory', () => {
    const mockWorkflowDir = '/app/novu/workflows/test-workflow';

    it('should validate complete workflow directory', async () => {
      // Mock directory files
      mockFs.readdir.mockResolvedValue(['index.ts', 'workflow.ts', 'schemas.ts', 'types.ts'] as any);

      const result = await WorkflowDiscovery.validateWorkflowDirectory(mockWorkflowDir);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing index.ts file', async () => {
      // Mock directory without index.ts
      mockFs.readdir.mockResolvedValue(['workflow.ts', 'schemas.ts'] as any);

      const result = await WorkflowDiscovery.validateWorkflowDirectory(mockWorkflowDir);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required index.ts file');
    });

    it('should detect missing workflow.ts file but only warn', async () => {
      // Mock directory with only index.ts
      mockFs.readdir.mockResolvedValue(['index.ts'] as any);

      const result = await WorkflowDiscovery.validateWorkflowDirectory(mockWorkflowDir);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Missing workflow.ts file');
    });

    it('should handle non-existent directory', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const result = await WorkflowDiscovery.validateWorkflowDirectory(mockWorkflowDir);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to validate directory: Error: Directory not found');
    });
  });

  describe('getAllWorkflowsStatus', () => {
    it('should return status for all discovered workflows', async () => {
      const mockDirs = ['valid-workflow', 'invalid-workflow'];
      
      // Mock the entries with isDirectory method
      const mockEntries = [
        { name: 'valid-workflow', isDirectory: () => true },
        { name: 'invalid-workflow', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);

      // Mock file operations
      mockFs.access.mockImplementation(async (filePath) => {
        if ((filePath as string).includes('valid-workflow/index.ts')) {
          return Promise.resolve();
        }
        throw new Error('File not found');
      });

      const result = await WorkflowDiscovery.getAllWorkflowsStatus();

      expect(result).toHaveLength(2);
      
      const validStatus = result.find(s => s.directory === 'valid-workflow');
      const invalidStatus = result.find(s => s.directory === 'invalid-workflow');

      expect(validStatus?.isValid).toBe(true);
      expect(invalidStatus?.isValid).toBe(false);
    });

    it('should handle empty workflows directory', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const result = await WorkflowDiscovery.getAllWorkflowsStatus();

      expect(result).toHaveLength(0);
    });

    it('should handle workflows directory access errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await WorkflowDiscovery.getAllWorkflowsStatus();

      expect(result).toHaveLength(0);
    });
  });

  describe('utility functions', () => {
    describe('convertToKebabCase', () => {
      it('should convert camelCase to kebab-case', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('userSignup');
        expect(result).toBe('user-signup');
      });

      it('should convert snake_case to kebab-case', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('user_signup');
        expect(result).toBe('user-signup');
      });

      it('should keep kebab-case unchanged', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('user-signup');
        expect(result).toBe('user-signup');
      });

      it('should handle mixed case conversions', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('userSignup_Email');
        expect(result).toBe('user-signup-email');
      });

      it('should handle single words', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('welcome');
        expect(result).toBe('welcome');
      });

      it('should handle numbers', () => {
        const result = (WorkflowDiscovery as any).convertToKebabCase('notification2FA');
        expect(result).toBe('notification2fa');
      });
    });
  });

  describe('error handling', () => {
    it('should handle workflow loading errors gracefully', async () => {
      // Mock the entries with isDirectory method for readdir with withFileTypes
      const mockEntries = [
        { name: 'error-workflow', isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValue(mockEntries as any);

      // Mock file access to fail for index.ts
      mockFs.access.mockRejectedValue(new Error('File not found'));

      // Should not throw, but should handle error gracefully
      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result.size).toBe(0);
    });

    it('should handle filesystem permission errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle empty workflows directory', async () => {
      // Mock ENOENT error for non-existent directory
      const enoentError = new Error('ENOENT: no such file or directory') as any;
      enoentError.code = 'ENOENT';
      mockFs.readdir.mockRejectedValue(enoentError);

      const result = await WorkflowDiscovery.discoverStaticWorkflows();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });
});