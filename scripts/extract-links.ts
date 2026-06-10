// Link extraction module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs collect
// Extractors should preserve canonical URL, source URL, domain, source platform, and fetch status.
export const command = 'extract-links';
export const fields = ['canonical_url', 'source_url', 'source_domain', 'source_platform', 'fetch_status'];
