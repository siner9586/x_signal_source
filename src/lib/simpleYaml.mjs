import fs from 'node:fs';

function stripInlineComment(value = '') {
  const text = String(value);
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '"' || ch === "'") && text[i - 1] !== '\\') quote = quote === ch ? '' : quote || ch;
    if (ch === '#' && !quote && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trim();
  }
  return text.trim();
}

function scalar(raw = '') {
  const value = stripInlineComment(raw).trim();
  if (!value) return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => scalar(item.trim()));
  }
  return value;
}

export function parseYamlList(text = '') {
  const items = [];
  let current = null;
  let listKey = '';

  const push = () => {
    if (current && Object.keys(current).length) items.push(current);
    current = null;
    listKey = '';
  };

  for (const rawLine of String(text).split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)?.[0].length || 0;
    const line = rawLine.trim();

    if (line.startsWith('- ')) {
      if (indent === 0) {
        push();
        current = {};
        const rest = line.slice(2).trim();
        const m = rest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (m) current[m[1]] = scalar(m[2]);
        continue;
      }
      if (current && listKey) {
        const value = scalar(line.slice(2));
        if (!Array.isArray(current[listKey])) current[listKey] = [];
        current[listKey].push(value);
      }
      continue;
    }

    if (!current) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (rawValue === '') {
      current[key] = [];
      listKey = key;
    } else {
      current[key] = scalar(rawValue);
      listKey = '';
    }
  }
  push();
  return items;
}

export function readYamlListSync(path, fallback = []) {
  if (!fs.existsSync(path)) return fallback;
  try {
    return parseYamlList(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}
