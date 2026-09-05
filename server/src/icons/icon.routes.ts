import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { generateSvgIcon } from './icon.scraper.js';

export const iconRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/icons/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeFilename = path.basename(filename);
    const filePath = path.join(config.faviconsDir, safeFilename);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'image/png';
      if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.ico') contentType = 'image/x-icon';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

      const fileBuffer = fs.readFileSync(filePath);
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=604800, immutable')
        .send(fileBuffer);
    }

    // Dynamic SVG fallback if file not yet downloaded or missing
    const initial = safeFilename.charAt(0).toUpperCase() || 'A';
    const svg = generateSvgIcon(initial, initial);
    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('Cache-Control', 'public, max-age=86400')
      .send(svg);
  });
};
