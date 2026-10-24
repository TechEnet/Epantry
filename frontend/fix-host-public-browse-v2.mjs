#!/usr/bin/env node
// EPANTRY safe, repeatable Host public-browsing repair.
// Place this file as frontend/fix-host-public-browse-v2.mjs, then run from frontend:
// node fix-host-public-browse-v2.mjs
// Only modifies frontend/src/components/layout/Navbar.jsx and frontend/src/api/apiClient.js.

import fs from 'node:fs';
import path from 'node:path';

const navbarPath = path.resolve('src/components/layout/Navbar.jsx');
const apiPath = path.resolve('src/api/apiClient.js');

function readFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}. Run from EPANTRY/frontend.`);
  return fs.readFileSync(file, 'utf8');
}

function updateNavbar(source) {
  const startMatch = /\bconst\s+navItems\s*=/.exec(source);
  if (!startMatch) throw new Error('Navbar: navItems declaration not found. No files changed.');
  const start = startMatch.index;
  const remainder = source.slice(start);
  const nextMatch = /\bconst\s*\{\s*hasAdminAccess\b/.exec(remainder);
  if (!nextMatch) throw new Error('Navbar: unable to locate end of navItems block. No files changed.');
  const end = start + nextMatch.index;
  const oldBlock = source.slice(start, end);

  if (!oldBlock.includes('useMemo') || !oldBlock.includes('HOST_NAV_ITEMS') ||
      !oldBlock.includes('BASE_NAV_ITEMS') || !oldBlock.includes('isHostPresentation')) {
    throw new Error('Navbar: unexpected navigation structure. No files changed.');
  }

  // Idempotent: both the latest already-updated navbar and reruns are safe.
  if (oldBlock.includes("label: 'Host Studio'") &&
      source.slice(Math.max(0, start - 350), end).includes('isOnHostWorkspace')) {
    return { text: source, status: 'already fixed' };
  }

  // Do not overwrite an unfamiliar partial/custom implementation.
  if (oldBlock.includes('Host Studio') || oldBlock.includes('isOnHostWorkspace')) {
    throw new Error('Navbar: partially customized navigation found. No files changed.');
  }

  const replacement = `const isOnHostWorkspace =\n        location.pathname === '/host' ||\n        location.pathname.startsWith('/host/');\n\n    // Host accounts can browse public pages without switching account mode.\n    const navItems = useMemo(() => {\n        if (isHostPresentation) {\n            if (isOnHostWorkspace) {\n                return [\n                    ...HOST_NAV_ITEMS.filter((item) =>\n                        isHostPathAllowed(item.to, hostWorkspaceType),\n                    ),\n                    { label: 'Home', to: '/' },\n                ];\n            }\n            return [\n                ...BASE_NAV_ITEMS,\n                { label: 'Host Studio', to: '/host/operations' },\n            ];\n        }\n        return [\n            ...BASE_NAV_ITEMS,\n            { label: 'Scan', to: '/scan' },\n        ];\n    }, [hostWorkspaceType, isHostPresentation, isOnHostWorkspace]);\n\n    `;

  return { text: source.slice(0, start) + replacement + source.slice(end), status: 'patched' };
}

const publicBrowsingHelper = `// These are public browsing routes, not personal/customer-only actions.\nfunction isPublicBrowsingPath(pathname) {\n  const pathnameOnly = String(pathname || '');\n  if ([\n    '/', '/grocery', '/brands', '/recipes', '/about', '/community', '/learn',\n  ].includes(pathnameOnly)) return true;\n  return [\n    '/grocery/', '/brands/', '/recipes/', '/about/', '/community/',\n    '/products/', '/product/', '/promotions/', '/creators/', '/dish-passports/',\n    '/explore/host-listings',\n  ].some(prefix => pathnameOnly.startsWith(prefix));\n}\n\n`;

function updateApi(source) {
  const start = source.indexOf('const customerContextRequired');
  if (start === -1) throw new Error('API: customerContextRequired guard not found. No files changed.');
  const dispatchIndex = source.indexOf('API_CUSTOMER_ACCESS_REQUIRED_EVENT', start);
  if (dispatchIndex === -1 || dispatchIndex - start > 1500) {
    throw new Error('API: customer access event not found where expected. No files changed.');
  }

  const guardBlock = source.slice(start, dispatchIndex);
  const isAlreadyFixed =
    guardBlock.includes('publicBrowsingLocation') ||
    (guardBlock.includes('isPublicBrowsingPath') && guardBlock.includes('requestMethod'));
  if (isAlreadyFixed) {
    if (!source.includes('function isPublicBrowsingPath(')) {
      throw new Error('API: public browsing guard exists but helper is missing. No files changed.');
    }
    return { text: source, status: 'already fixed' };
  }

  const oldGuardPattern = /customerContextRequired\s*&&\s*typeof\s+window\s*!==\s*['"]undefined['"]/;
  if (!oldGuardPattern.test(guardBlock)) {
    throw new Error('API: unfamiliar customer access guard. No files changed.');
  }
  if (!source.includes('const requestMethod')) {
    throw new Error('API: requestMethod not available. No files changed.');
  }

  const modified = source.slice(0, start) +
    guardBlock.replace(oldGuardPattern,
      `customerContextRequired &&\n      typeof window !== 'undefined' &&\n      !(requestMethod === 'GET' && isPublicBrowsingPath(window.location.pathname))`) +
    source.slice(dispatchIndex);
  if (modified === source) throw new Error('API: no guard modification made. No files changed.');

  if (modified.includes('function isPublicBrowsingPath(')) {
    return { text: modified, status: 'patched' };
  }
  const anchor = modified.indexOf('apiClient.interceptors.response.use(');
  if (anchor < 0) throw new Error('API: response interceptor anchor missing. No files changed.');
  return {
    text: modified.slice(0, anchor) + publicBrowsingHelper + modified.slice(anchor),
    status: 'patched',
  };
}

try {
  const originalNavbar = readFile(navbarPath);
  const originalApi = readFile(apiPath);
  // Complete preflight first: NEVER write one file if the other cannot be safely patched.
  const navbar = updateNavbar(originalNavbar);
  const api = updateApi(originalApi);
  const changed = [
    [navbarPath, originalNavbar, navbar],
    [apiPath, originalApi, api],
  ].filter(([, oldText, result]) => oldText !== result.text);

  if (changed.length) {
    const suffix = new Date().toISOString().replace(/[:.]/g, '-');
    for (const [file, oldText] of changed) {
      fs.writeFileSync(`${file}.before-public-browse-${suffix}.bak`, oldText);
    }
    for (const [file, , result] of changed) {
      fs.writeFileSync(file, result.text);
    }
  }
  console.log(`Navbar: ${navbar.status}`);
  console.log(`API client: ${api.status}`);
  console.log(changed.length ? 'Patch applied; originals backed up.' : 'Fix already present; no files changed.');
  console.log('Next: npm run build, then test Home/Grocery/Recipes while in Host mode.');
} catch (error) {
  console.error(`STOP: ${error.message}`);
  process.exitCode = 1;
}
