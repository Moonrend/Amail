#!/usr/bin/env node

/**
 * 快速发版脚本
 * 用法: node scripts/release.js [patch|minor|major]
 * 默认: patch
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const PACKAGES = [
  'packages/amail-node/package.json',
  'packages/cli/package.json',
];

const bump = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`用法: node scripts/release.js [patch|minor|major]`);
  process.exit(1);
}

// 读取当前版本
const pkg = JSON.parse(readFileSync(join(ROOT, PACKAGES[0]), 'utf-8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

// 计算新版本
const newVersion = bump === 'major'
  ? `${major + 1}.0.0`
  : bump === 'minor'
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

console.log(`📦 ${pkg.version} → ${newVersion}\n`);

// 更新所有 package.json
for (const pkgPath of PACKAGES) {
  const fullPath = join(ROOT, pkgPath);
  const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const oldVersion = content.version;
  content.version = newVersion;
  writeFileSync(fullPath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ✅ ${pkgPath}: ${oldVersion} → ${newVersion}`);
}

// Git 操作
const tag = `v${newVersion}`;
const commands = [
  'git add -A',
  `git commit -m "release: ${tag}"`,
  `git tag -a ${tag} -m "release: ${tag}"`,
  `git push origin main --tags`,
];

console.log(`\n🚀 推送 tag: ${tag}\n`);
for (const cmd of commands) {
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error(`\n❌ 命令失败: ${cmd}`);
    process.exit(1);
  }
}

console.log(`\n✅ ${tag} 已推送！GitHub Actions 将自动构建和发布。`);
