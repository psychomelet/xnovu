import { execSync } from 'child_process';

// Docker configuration
export const DEFAULT_REGISTRY = 'registry.cn-shanghai.aliyuncs.com/yogosystem';
export const IMAGE_NAME = 'xnovu';

export interface DockerTags {
  tags: string[];
  localTag: string;
  commitId: string;
}

export function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getGitVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function isWorkingTreeDirty(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

export function generateTags(): DockerTags {
  const gitSha = getGitSha();
  const version = getGitVersion();
  const isDirty = isWorkingTreeDirty();
  
  const commitId = `${gitSha}${isDirty ? '-dirty' : ''}`;
  const localTag = `${IMAGE_NAME}:${commitId}`;
  
  const tags = [gitSha];
  if (version) {
    tags.push(version);
  }
  tags.push('latest');
  
  return { tags, localTag, commitId };
}

export function getBuildDate(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}