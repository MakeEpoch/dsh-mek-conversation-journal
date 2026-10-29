// Run in one process: some desktop sandbox launchers do not forward Node test
// worker IPC. Direct registration preserves individual assertion accounting.
await import('./core.test.mjs');
await import('./notion.test.mjs');
await import('./settings-model.test.mjs');
