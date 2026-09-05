import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config.js';

const httpsAgent = new https.Agent({
  rejectUnauthorized: config.strictSSL,
});

const client = axios.create({
  timeout: 3000,
  httpsAgent,
  headers: {
    'User-Agent': 'Gatekeeper-Favicon-Scraper/1.0',
  },
  validateStatus: (status) => status < 400,
});

export function generateSvgIcon(letter: string, title: string): string {
  const char = (letter || 'A').toUpperCase().charAt(0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="grad-${char}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5364f0" />
      <stop offset="100%" stop-color="#8553f0" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#grad-${char})" />
  <text x="32" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">${char}</text>
</svg>`;
}

export async function fetchAndCacheIcon(appId: string, domain: string, scheme: string, title: string): Promise<string> {
  const sanitizedId = appId.replace(/[^a-zA-Z0-9_-]/g, '');
  const targetSvgPath = path.join(config.faviconsDir, `${sanitizedId}.svg`);
  const targetPngPath = path.join(config.faviconsDir, `${sanitizedId}.png`);

  // Instant fast path for demo apps or unresolvable homelab local domains
  if (appId.startsWith('demo-') || domain.endsWith('.local') || domain.endsWith('.lan') || domain.endsWith('.internal')) {
    const firstLetter = title ? title.charAt(0) : domain.charAt(0);
    const svgContent = generateSvgIcon(firstLetter, title);
    fs.writeFileSync(targetSvgPath, svgContent, 'utf8');
    return `${sanitizedId}.svg`;
  }
  const baseUrl = `${scheme || 'http'}://${domain}`;
  try {
    // Check direct /favicon.ico
    const icoResponse = await client.get(`${baseUrl}/favicon.ico`, {
      responseType: 'arraybuffer',
      timeout: 2500,
    });
    if (icoResponse.status === 200 && icoResponse.data && icoResponse.data.length > 32) {
      fs.writeFileSync(targetPngPath, Buffer.from(icoResponse.data));
      return `${sanitizedId}.png`;
    }
  } catch {
    // Continue to HTML scraping
  }

  try {
    // Check root HTML for <link rel="icon">
    const htmlResponse = await client.get(baseUrl, { timeout: 2500 });
    if (typeof htmlResponse.data === 'string') {
      const $ = cheerio.load(htmlResponse.data);
      let iconHref = $('link[rel="icon"]').attr('href') ||
                     $('link[rel="shortcut icon"]').attr('href') ||
                     $('link[rel="apple-touch-icon"]').attr('href');

      if (iconHref) {
        if (iconHref.startsWith('//')) {
          iconHref = `${scheme || 'http'}:${iconHref}`;
        } else if (iconHref.startsWith('/')) {
          iconHref = `${baseUrl}${iconHref}`;
        } else if (!iconHref.startsWith('http')) {
          iconHref = `${baseUrl}/${iconHref}`;
        }

        const downloaded = await client.get(iconHref, { responseType: 'arraybuffer', timeout: 2500 });
        if (downloaded.status === 200 && downloaded.data && downloaded.data.length > 32) {
          const ext = iconHref.endsWith('.svg') ? '.svg' : '.png';
          const filePath = path.join(config.faviconsDir, `${sanitizedId}${ext}`);
          fs.writeFileSync(filePath, Buffer.from(downloaded.data));
          return `${sanitizedId}${ext}`;
        }
      }
    }
  } catch {
    // Continue to public cache fallback
  }

  // Step 2: External Fallback (Google Favicons API) if public internet available
  try {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const fallbackResponse = await client.get(googleFaviconUrl, {
      responseType: 'arraybuffer',
      timeout: 2000,
    });
    if (fallbackResponse.status === 200 && fallbackResponse.data && fallbackResponse.data.length > 200) {
      fs.writeFileSync(targetPngPath, Buffer.from(fallbackResponse.data));
      return `${sanitizedId}.png`;
    }
  } catch {
    // Fall back to generated SVG
  }

  // Step 3: Offline / Homelab SVG Icon Generator
  const firstLetter = title ? title.charAt(0) : domain.charAt(0);
  const svgContent = generateSvgIcon(firstLetter, title);
  fs.writeFileSync(targetSvgPath, svgContent, 'utf8');
  return `${sanitizedId}.svg`;
}
