import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Helper to parse .env file
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

// 1. Load configuration
const envFromConfigDir = process.env.HERDR_PLUGIN_CONFIG_DIR 
  ? loadEnv(path.join(process.env.HERDR_PLUGIN_CONFIG_DIR, '.env'))
  : {};
const envFromFallback = loadEnv(path.join('/opt/herdr-ntfy-notify', '.env'));

const config = {
  NTFY_EXTERNAL_URL: process.env.HERDR_NTFY_EXTERNAL_URL || process.env.NTFY_EXTERNAL_URL || envFromConfigDir.HERDR_NTFY_EXTERNAL_URL || envFromConfigDir.NTFY_EXTERNAL_URL || envFromFallback.HERDR_NTFY_EXTERNAL_URL || envFromFallback.NTFY_EXTERNAL_URL || 'http://localhost:10081',
  NTFY_LOCAL_URL: process.env.HERDR_NTFY_LOCAL_URL || process.env.NTFY_LOCAL_URL || envFromConfigDir.HERDR_NTFY_LOCAL_URL || envFromConfigDir.NTFY_LOCAL_URL || envFromFallback.HERDR_NTFY_LOCAL_URL || envFromFallback.NTFY_LOCAL_URL || 'http://127.0.0.1:10081',
  NTFY_TOPIC: process.env.HERDR_NTFY_TOPIC || process.env.NTFY_TOPIC || envFromConfigDir.HERDR_NTFY_TOPIC || envFromConfigDir.NTFY_TOPIC || envFromFallback.HERDR_NTFY_TOPIC || envFromFallback.NTFY_TOPIC || 'herdr-alerts',
  HERDR_NTFY_ENABLED: process.env.HERDR_NTFY_ENABLED || envFromConfigDir.HERDR_NTFY_ENABLED || envFromFallback.HERDR_NTFY_ENABLED || '1',
  NTFY_BEARER_TOKEN: process.env.HERDR_NTFY_BEARER_TOKEN || process.env.NTFY_BEARER_TOKEN || envFromConfigDir.HERDR_NTFY_BEARER_TOKEN || envFromConfigDir.NTFY_BEARER_TOKEN || envFromFallback.HERDR_NTFY_BEARER_TOKEN || envFromFallback.NTFY_BEARER_TOKEN || '',
  NTFY_PRIORITY_DONE: process.env.HERDR_NTFY_PRIORITY_DONE || envFromConfigDir.HERDR_NTFY_PRIORITY_DONE || envFromFallback.HERDR_NTFY_PRIORITY_DONE || 'default',
  NTFY_PRIORITY_BLOCKED: process.env.HERDR_NTFY_PRIORITY_BLOCKED || envFromConfigDir.HERDR_NTFY_PRIORITY_BLOCKED || envFromFallback.HERDR_NTFY_PRIORITY_BLOCKED || 'high',
  NTFY_TAGS_DONE: process.env.HERDR_NTFY_TAGS_DONE || envFromConfigDir.NTFY_TAGS_DONE || envFromFallback.NTFY_TAGS_DONE || '',
  NTFY_TAGS_BLOCKED: process.env.HERDR_NTFY_TAGS_BLOCKED || envFromConfigDir.NTFY_TAGS_BLOCKED || envFromFallback.NTFY_TAGS_BLOCKED || '',
};

const isEnabled = !['0', 'false', 'no', 'off'].includes(config.HERDR_NTFY_ENABLED.toString().toLowerCase());

// Auto-endpoint detection: try local ntfy server first if configured
async function resolveNtfyUrl() {
  if (!config.NTFY_LOCAL_URL) return config.NTFY_EXTERNAL_URL;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 800); // 800ms quick check timeout
    const res = await fetch(`${config.NTFY_LOCAL_URL}/`, { signal: controller.signal });
    clearTimeout(id);
    if (res.ok || res.status === 404 || res.status === 405) {
      return config.NTFY_LOCAL_URL;
    }
  } catch (err) {
    // Local server unreachable, fallback to default base URL
  }
  return config.NTFY_EXTERNAL_URL;
}

// Publish using curl command (fast and handles local tailnet SSL gracefully if any)
function publishWithCurl(url, headers, body) {
  try {
    const args = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST'];
    for (const [key, value] of Object.entries(headers)) {
      args.push('-H', `${key}: ${value}`);
    }
    args.push('-d', body);
    args.push(url);

    // Escape args safely for exec
    const cmd = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
    const stdout = execSync(cmd, { stdio: 'pipe' }).toString().trim();
    const statusCode = parseInt(stdout, 10);
    return statusCode >= 200 && statusCode < 300;
  } catch (err) {
    return false;
  }
}

// Get dynamic, situation-specific tags/emojis
function getTags(status, agent, text) {
  const tagsSet = new Set();

  // 1. Configured custom tags prefix
  const customTags = status === 'done' ? config.NTFY_TAGS_DONE : config.NTFY_TAGS_BLOCKED;
  if (customTags) {
    for (const t of customTags.split(',')) {
      const trimmed = t.trim();
      if (trimmed) tagsSet.add(trimmed);
    }
  }

  // 2. Status-specific base emoji
  if (status === 'done') {
    tagsSet.add('white_check_mark');
  } else if (status === 'blocked') {
    const textLower = text.toLowerCase();
    if (text.includes('?') || textLower.includes('prompt') || textLower.includes('choose') || textLower.includes('ask')) {
      tagsSet.add('question');
    } else if (textLower.includes('error') || textLower.includes('fail') || textLower.includes('exception')) {
      tagsSet.add('x');
    } else {
      tagsSet.add('warning');
    }
  }

  // 3. Agent-specific emoji
  const agentLower = agent.toLowerCase();
  if (agentLower.includes('codex')) {
    tagsSet.add('scroll');
  } else if (agentLower.includes('hermes')) {
    tagsSet.add('speech_balloon');
  } else if (agentLower.includes('omp') || agentLower.includes('pi') || agentLower.includes('task')) {
    tagsSet.add('tools');
  } else if (agentLower.includes('librarian')) {
    tagsSet.add('books');
  }

  // 4. Test run indicator
  if (text.toLowerCase().includes('test')) {
    tagsSet.add('test_tube');
  }

  return Array.from(tagsSet).join(',');
}

async function run() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');

  if (isTest) {
    if (!isEnabled) {
      console.log("ntfy plugin is disabled by config.");
      return;
    }
    await sendNotification({
      title: 'Herdr ntfy test',
      body: 'Plugin can publish to ntfy.',
      priority: 'default',
      tags: 'bell,test_tube',
    });
    return;
  }

  if (!isEnabled) {
    return;
  }

  // Parse event and context from env
  let event = {};
  let context = {};

  if (process.env.HERDR_PLUGIN_EVENT_JSON) {
    try {
      event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON);
    } catch (err) {
      console.error("Invalid HERDR_PLUGIN_EVENT_JSON:", err.message);
      return;
    }
  }

  if (process.env.HERDR_PLUGIN_CONTEXT_JSON) {
    try {
      context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON);
    } catch (err) {
      console.error("Invalid HERDR_PLUGIN_CONTEXT_JSON:", err.message);
      return;
    }
  }

  const status = (
    event?.data?.agent_status || 
    context?.focused_pane_status || 
    context?.agent_status || 
    context?.status || 
    ''
  ).toLowerCase();

  if (status !== 'done' && status !== 'blocked') {
    return;
  }

  const agent = event?.data?.display_agent || event?.data?.agent || context?.focused_pane_agent || context?.agent || 'Agent';
  const workspace = event?.data?.workspace || context?.focused_pane_workspace || context?.workspace || '';
  const tab = event?.data?.tab || context?.focused_pane_tab || context?.tab || '';
  const paneId = event?.data?.pane_id || context?.focused_pane_id || '';
  const customStatus = event?.data?.custom_status || context?.custom_status || '';
  const title = event?.data?.title || context?.title || '';
  const error = event?.data?.state_labels?.error || '';
  const task = event?.data?.state_labels?.task || '';
  const session = process.env.HERDR_SESSION || '';

  // Construct message header / description
  let header = `${agent} is ${status}`;
  if (customStatus) {
    header += `: ${customStatus}`;
  } else if (error) {
    header += `: ${error}`;
  } else if (task) {
    header += `: ${task}`;
  } else if (title) {
    header += ` (${title})`;
  }

  if (header.length > 200) {
    header = header.slice(0, 197) + '...';
  }

  let body = header;
  const details = [];
  if (session) {
    details.push(`Session: ${session}`);
  }
  if (workspace) {
    let loc = `Loc: ${workspace}`;
    if (tab) loc += ` · ${tab}`;
    if (paneId) loc += ` (pane ${paneId})`;
    details.push(loc);
  }

  if (details.length > 0) {
    body += `\n${details.join('\n')}`;
  }

  const notification = {
    title: status === 'done' ? 'Herdr agent done' : 'Herdr agent needs action',
    body,
    priority: status === 'done' ? config.NTFY_PRIORITY_DONE : config.NTFY_PRIORITY_BLOCKED,
    tags: getTags(status, agent, body),
  };

  await sendNotification(notification);
}

async function sendNotification({ title, body, priority, tags }) {
  const baseUrl = await resolveNtfyUrl();
  const url = `${baseUrl}/${encodeURIComponent(config.NTFY_TOPIC)}`;
  const headers = {
    'Title': title,
    'Priority': priority,
    'Tags': tags,
    'Content-Type': 'text/plain; charset=utf-8',
  };

  if (config.NTFY_BEARER_TOKEN) {
    if (config.NTFY_BEARER_TOKEN.includes(':')) {
      const encoded = Buffer.from(config.NTFY_BEARER_TOKEN).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else {
      headers['Authorization'] = `Bearer ${config.NTFY_BEARER_TOKEN}`;
    }
  }

  // 1. Try sending with curl (open-source way: if local curl is available)
  const curlSuccess = publishWithCurl(url, headers, body);
  if (curlSuccess) {
    return;
  }

  // 2. Fallback to native Node fetch
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      const responseText = await res.text();
      console.error(`ntfy publish failed (fetch): ${res.status} ${responseText}`);
    }
  } catch (err) {
    console.error("ntfy publish failed with network error:", err.message);
  }
}

run().catch(err => {
  console.error("Unhandled error in notify.mjs:", err);
  process.exit(0); // non-fatal to herdr
});
