const express = require('express');
const path = require('path');
const apiRoutes = require('./api-routes');

const app = express();
const PORT = 3001;

// Parse JSON bodies
app.use(express.json());

// API routes (no special headers needed for API)
app.use('/api', apiRoutes);

// Set required headers for SharedArrayBuffer (multi-threading support) - only for static files
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Serve node_modules for ffmpeg libraries
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.listen(PORT, () => {
  console.log(`\n🎬 Video Compressor Dev Server`);
  console.log(`   Web UI: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`\n✅ Headers configured for multi-threading`);
  console.log(`🚀 API endpoints available:`);
  console.log(`   POST /api/compress - Compress video`);
  console.log(`   GET  /api/info - API documentation`);
  console.log(`   GET  /api/health - Health check\n`);
});
