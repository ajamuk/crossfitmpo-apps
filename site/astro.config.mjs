import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.crossfitmetropolitano.com',
  integrations: [sitemap()],
  trailingSlash: 'always',
  build: { format: 'directory' },
});
