// Site data generation module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs generate-site-data
// Generates public/index-data/latest.json, issues.json, and search.json for the Astro frontend.
export const command = 'generate-site-data';
export const output = ['public/index-data/latest.json', 'public/index-data/issues.json', 'public/index-data/search.json'];
