import { copyFile, mkdir, readFile, realpath, writeFile, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const source = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const home = process.env.DSH_HOME || join(homedir(), '.dsh');
const profileName = process.env.DSH_PROFILE || 'web';
if (!/^[\w-]+$/.test(profileName)) throw new Error('Invalid profile name');
const profile = join(home, 'profiles', profileName);
const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (!manifest.dsh?.profile?.bundles?.includes('@deepseek-ai/dsh-web-app')) throw new Error('Target must be an existing DSH Web profile');
const bundle = await readFile(join(source, 'lib/client.js'), 'utf8');
if (!bundle.includes('window.__ModuleLoader__.load(') || !bundle.includes(pkg.name)) throw new Error('Build the client first');
const spec = `link:${source}`;
console.log(JSON.stringify({ profile, plugin: pkg.name, version: pkg.version, source: spec }, null, 2));
if (process.argv.includes('--dry-run')) process.exit(0);
let backup = null;
if (manifest.dependencies?.[pkg.name] !== spec || !manifest.dsh.profile.bundles.includes(pkg.name)) {
  backup = join(profile, '.plugin-manager', `conversation-journal-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(backup, { recursive: true, mode: 0o700 });
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml']) {
    try { const target = join(backup, name); await copyFile(join(profile, name), target); await chmod(target, 0o600); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  console.log(`Backup: ${backup}`);
  const result = spawnSync(process.env.DSH_BIN || 'dsh', ['plugin', '--profile', profileName, 'add', spec, '--offline', '--ignore-scripts'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`DSH installer failed (${result.status}); backup kept at ${backup}`);
}
const installed = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
const resolved = await realpath(join(profile, 'node_modules', ...pkg.name.split('/')));
if (installed.dependencies?.[pkg.name] !== spec || !installed.dsh?.profile?.bundles?.includes(pkg.name) || resolved !== source) throw new Error('Installation readback failed; inspect the profile before restarting');
await mkdir(join(source, 'artifacts'), { recursive: true });
await writeFile(join(source, 'artifacts/install.json'), JSON.stringify({ profile, source, version: pkg.version, backup, installedAt: new Date().toISOString(), verified: { manifest: true, bundle: true, resolver: true }, browserActivation: false }, null, 2), { mode: 0o600 });
console.log('Installed and read back. Restart the corresponding DSH Web process, reload the page, then open 设置 → 对话整理.');
