import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowDiscovery } from '../../app/services/workflow/WorkflowDiscovery';

// This is a unit test that still uses real file system operations
// as per the "no mocking" principle in __tests__/CLAUDE.md

describe('WorkflowDiscovery Unit Tests', () => {
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
});
