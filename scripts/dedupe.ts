// Dedupe module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs build-issue
// Dedupe keys include canonical URL, normalized URL, title hash, author + title and cluster_id.
export const command = 'dedupe';
export const checkedKeys = ['canonical_url', 'normalized_url', 'source_url', 'title_hash', 'author_title', 'cluster_id', 'dedupe_key'];
export const rule = 'Second issue must not reuse content from the first issue; later issues must exclude all prior selected items.';
