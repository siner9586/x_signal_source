// QA module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs qa
// Checks required files, latest issue consistency, selected item fields, duplicate URLs/keys, cron, and README compliance notes.
export const command = 'qa';
export const checks = ['required files', 'selected_count', 'required item fields', 'duplicate URLs', 'duplicate dedupe keys', 'cron 12 22 * * *', 'README compliance'];
