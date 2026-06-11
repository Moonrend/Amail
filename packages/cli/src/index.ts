#!/usr/bin/env node

import { createInterface, type Interface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.amail');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  key?: string;
  url?: string;
}

// ── Config helpers ────────────────────────────────────────────────

function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Readline helpers ──────────────────────────────────────────────

function createRl(): Interface {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: Interface, question: string, fallback = ''): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim() || fallback);
    });
  });
}

async function askRequired(rl: Interface, question: string): Promise<string> {
  while (true) {
    const val = await ask(rl, question);
    if (val) return val;
    console.log('  ⚠️  此项必填，请重新输入');
  }
}

// ── API call helper (plain fetch, no SDK dependency) ──────────────

async function apiCall(
  config: Config,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${config.url || 'http://localhost:4000'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.key}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ── Banner ────────────────────────────────────────────────────────

function banner(): void {
  console.log();
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║         📧 Amail CLI v1.0.0          ║');
  console.log('  ║    自托管邮件代理网关命令行工具       ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log();
}

// ── Setup flow ────────────────────────────────────────────────────

async function setupFlow(rl: Interface): Promise<Config> {
  console.log('🔧 首次使用，请先配置连接信息\n');

  const config = loadConfig();

  const url = await ask(rl, '  服务地址 (默认 http://localhost:4000): ', 'http://localhost:4000');
  config.url = url;

  const key = await askRequired(rl, '  API 密钥 (am_xxx): ');
  config.key = key;

  saveConfig(config);

  // Verify connection
  console.log('\n  🔍 验证连接...');
  const res = await apiCall(config, 'GET', '/health');
  if (res.ok) {
    console.log('  ✅ 连接成功\n');
  } else {
    console.log(`  ⚠️  连接失败 (${res.status})，配置已保存，请检查服务地址和密钥\n`);
  }

  return config;
}

// ── Send flow ─────────────────────────────────────────────────────

async function sendFlow(rl: Interface, config: Config): Promise<void> {
  console.log('── 📨 发送邮件 ──────────────────────────\n');

  // Provider selection
  let providerId: string | undefined;
  const providersRes = await apiCall(config, 'GET', '/emails/providers');
  if (providersRes.ok && providersRes.data?.data?.length > 0) {
    const providers = providersRes.data.data;
    console.log('  可用发件通道 (Provider):');
    providers.forEach((p: any, i: number) => {
      console.log(`    ${i + 1}. ${p.name} (${p.host}${p.from_address ? ', ' + p.from_address : ''})`);
    });
    while (!providerId) {
      const providerChoice = await ask(rl, '  选择 Provider 编号: ');
      const idx = parseInt(providerChoice, 10);
      if (idx > 0 && idx <= providers.length) {
        providerId = providers[idx - 1].id;
        console.log(`  ✅ 已选择: ${providers[idx - 1].name}`);
      } else {
        console.log('  ⚠️  请选择有效的 Provider 编号');
      }
    }
    console.log();
  } else {
    console.log('  ❌ 未找到可用 Provider，请先在管理后台添加 SMTP 配置');
    return;
  }

  // From (optional if provider has from_address)
  const from = await ask(rl, '  发件人 (回车使用通道默认地址): ');

  // To
  const to = await askRequired(rl, '  收件人 (多个用逗号分隔): ');

  // Subject
  const subject = await askRequired(rl, '  主题: ');

  // Content type
  console.log('\n  内容格式:');
  console.log('    1. 纯文本');
  console.log('    2. HTML');
  const format = await ask(rl, '  选择 (1/2, 默认 1): ', '1');

  let html: string | undefined;
  let text: string | undefined;

  if (format === '2') {
    console.log('  输入 HTML 内容 (输入单独一行 . 结束):');
    html = await readMultiline(rl);
  } else {
    console.log('  输入正文 (输入单独一行 . 结束):');
    text = await readMultiline(rl);
  }

  // Optional fields
  console.log('\n  可选字段 (直接回车跳过):');
  const cc = await ask(rl, '  抄送: ');
  const bcc = await ask(rl, '  密送: ');
  const replyTo = await ask(rl, '  回复地址: ');

  // Build payload
  const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
  const payload: Record<string, unknown> = {
    from,
    to: toList.length === 1 ? toList[0] : toList,
    subject,
  };
  payload.provider_id = providerId;
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (cc) {
    const ccList = cc.split(',').map((s) => s.trim()).filter(Boolean);
    payload.cc = ccList.length === 1 ? ccList[0] : ccList;
  }
  if (bcc) {
    const bccList = bcc.split(',').map((s) => s.trim()).filter(Boolean);
    payload.bcc = bccList.length === 1 ? bccList[0] : bccList;
  }
  if (replyTo) payload.reply_to = replyTo;

  // Confirm
  console.log('\n── 📋 邮件摘要 ──────────────────────────');
  console.log(`  通道ID:  ${providerId}`);
  console.log(`  发件人:  ${from}`);
  console.log(`  收件人:  ${to}`);
  console.log(`  主题:    ${subject}`);
  console.log(`  内容:    ${(html || text || '').substring(0, 80)}${(html || text || '').length > 80 ? '...' : ''}`);
  if (cc) console.log(`  抄送:    ${cc}`);
  if (bcc) console.log(`  密送:    ${bcc}`);
  if (replyTo) console.log(`  回复:    ${replyTo}`);
  console.log();

  const confirm = await ask(rl, '  确认发送? (Y/n): ', 'Y');
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('  ❎ 已取消');
    return;
  }

  // Send
  console.log('\n  ⏳ 发送中...');
  const res = await apiCall(config, 'POST', '/emails', payload);

  if (res.ok) {
    console.log(`  ✅ 发送成功!`);
    console.log(`  📧 邮件 ID: ${res.data.id}`);
  } else {
    console.log(`  ❌ 发送失败 (${res.status})`);
    console.log(`  ${res.data?.message || JSON.stringify(res.data)}`);
  }
}

async function readMultiline(rl: Interface): Promise<string> {
  const lines: string[] = [];
  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (line === '.') {
        rl.removeListener('line', handler);
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    };
    rl.on('line', handler);
  });
}

// ── Status flow ───────────────────────────────────────────────────

async function statusFlow(rl: Interface, config: Config): Promise<void> {
  console.log('── 🔍 查询邮件状态 ──────────────────────\n');

  const id = await askRequired(rl, '  邮件 ID: ');

  console.log('  ⏳ 查询中...');
  const res = await apiCall(config, 'GET', `/emails/${id}`);

  if (!res.ok) {
    console.log(`  ❌ 查询失败 (${res.status}): ${res.data?.message || '未知错误'}`);
    return;
  }

  const e = res.data;
  console.log('\n  📧 邮件详情');
  console.log(`  ID:      ${e.id}`);
  console.log(`  主题:    ${e.subject}`);
  console.log(`  发件人:  ${e.from}`);
  console.log(`  收件人:  ${Array.isArray(e.to) ? e.to.join(', ') : e.to}`);
  console.log(`  状态:    ${e.last_event || e.status}`);
  console.log(`  创建:    ${e.created_at}`);
  if (e.sent_at) console.log(`  发送:    ${e.sent_at}`);
  if (e.last_error) console.log(`  错误:    ${e.last_error}`);
}

// ── Main menu ─────────────────────────────────────────────────────

async function mainMenu(rl: Interface, config: Config): Promise<void> {
  while (true) {
    console.log('── 📋 功能菜单 ──────────────────────────\n');
    console.log('  1. 发送邮件');
    console.log('  2. 查询邮件状态');
    console.log('  3. 查看配置');
    console.log('  4. 重新配置');
    console.log('  0. 退出\n');

    const choice = await ask(rl, '  请选择: ');

    switch (choice) {
      case '1':
        await sendFlow(rl, config);
        break;
      case '2':
        await statusFlow(rl, config);
        break;
      case '3':
        console.log(`\n  📋 当前配置:`);
        console.log(`  服务地址: ${config.url || 'http://localhost:4000'}`);
        console.log(`  API 密钥: ${config.key ? config.key.slice(0, 10) + '...' : '(未设置)'}`);
        console.log(`  配置文件: ${CONFIG_FILE}\n`);
        break;
      case '4':
        config = await setupFlow(rl);
        break;
      case '0':
        console.log('\n  👋 再见!\n');
        rl.close();
        process.exit(0);
      default:
        console.log('  ⚠️  无效选择，请重试\n');
    }

    console.log();
  }
}

// ── Entry ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Quick commands: amail get <id>, amail help
  if (args[0] === 'get' && args[1]) {
    const config = loadConfig();
    if (!config.key) {
      console.error('❌ 未配置，请先运行 amail 进入配置');
      process.exit(1);
    }
    const res = await apiCall(config, 'GET', `/emails/${args[1]}`);
    if (res.ok) {
      console.log(JSON.stringify(res.data, null, 2));
    } else {
      console.error(`❌ ${res.status}: ${res.data?.message || '查询失败'}`);
      process.exit(1);
    }
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log('amail-cli 1.0.0');
    return;
  }

  // Interactive mode
  banner();

  let config = loadConfig();

  // First-time setup
  if (!config.key) {
    config = await setupFlow(createRl());
  } else {
    console.log(`  已连接: ${config.url || 'http://localhost:4000'}\n`);
  }

  const rl = createRl();
  await mainMenu(rl, config);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
