// Public metadata fetch module.
// Runtime entrypoint: node scripts/pipeline.mjs daily
// Future collectors should only access public pages, RSS/Atom, sitemap, GitHub, YouTube RSS, podcast feeds, and metadata that can be accessed without bypassing restrictions.
export const command = 'fetch-public';
export const compliance = ['no paid API', 'no login bypass', 'no paywall bypass', 'low frequency', 'cache failures'];
