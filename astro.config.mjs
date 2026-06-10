import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://siner9586.github.io/x_signal_source',
  integrations: [sitemap()],
  output: 'static'
});