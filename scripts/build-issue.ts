// Issue generation module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs build-issue
// Generates data/issues/YYYY-MM-DD.json and content/issues/YYYY-MM-DD.md.
export const command = 'build-issue';
export const output = ['data/issues/YYYY-MM-DD.json', 'content/issues/YYYY-MM-DD.md'];
