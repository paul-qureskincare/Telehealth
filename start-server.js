#!/usr/bin/env node

/**
 * React Router Server Wrapper with Compression
 * 
 * This wrapper starts the React Router server with compression middleware enabled.
 * It ensures all responses > 1KB are automatically gzipped.
 * 
 * Usage: node start-server.js
 */

import compression from 'compression';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

/**
 * Dynamically import the built server
 */
async function startServer() {
  try {
    // Check if build exists
    const buildPath = path.join(__dirname, 'build', 'server', 'index.js');
    if (!fs.existsSync(buildPath)) {
      console.error('[StartServer] ❌ Build not found at', buildPath);
      console.error('[StartServer] Run: npm run build');
      process.exit(1);
    }

    // Import the React Router serve handler
    const { default: handler } = await import(buildPath);

    // Create HTTP server with compression middleware
    const server = createServer((req, res) => {
      // Apply compression middleware
      const compressionMiddleware = compression({
        threshold: 1024, // Only compress > 1KB
        level: 6,        // Balanced compression level
      });

      compressionMiddleware(req, res, () => {
        // Handle request with React Router
        Promise.resolve(handler(req, res)).catch(err => {
          console.error('[StartServer] Request handler error:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`[StartServer] ✅ Server running on http://localhost:${PORT}`);
      console.log('[StartServer] 🗜️  Compression enabled (threshold: 1KB, level: 6)');
      console.log('[StartServer] Cache payloads will be gzipped automatically');
    });

  } catch (error) {
    console.error('[StartServer] ❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
