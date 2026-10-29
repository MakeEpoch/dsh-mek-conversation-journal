import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = require(process.env.DSH_ESBUILD_MODULE || 'esbuild');
const result = await build({ absWorkingDir: fileURLToPath(new URL('../', import.meta.url)), entryPoints: ['client/index.js'], bundle: true,
  write: false, platform: 'browser', format: 'cjs', target: ['chrome100'], external: ['react'], legalComments: 'none' });
const content = `// Generated DSH Client ModuleLoader bundle.\nwindow.__ModuleLoader__.load({id:"dsh-mek-conversation-journal",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`;
await mkdir(new URL('../lib', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/client.js', import.meta.url), content);
console.log(`Built lib/client.js (${Buffer.byteLength(content)} bytes)`);
