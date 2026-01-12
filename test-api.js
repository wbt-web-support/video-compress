/**
 * Test script for Video Compressor API
 *
 * Usage:
 *   node test-api.js path/to/video.mp4
 *
 * Example:
 *   node test-api.js videos/Bootcamp\ Video\ 1_v2.mp4
 */

const fs = require('fs');
const path = require('path');

async function testAPI(videoPath) {
    if (!fs.existsSync(videoPath)) {
        console.error('❌ Error: Video file not found:', videoPath);
        process.exit(1);
    }

    console.log('🎬 Video Compressor API Test\n');
    console.log('📂 Input video:', videoPath);

    const stats = fs.statSync(videoPath);
    console.log('📏 File size:', formatSize(stats.size));
    console.log('🚀 Starting compression...\n');

    try {
        // Import fetch dynamically (Node 18+)
        const fetch = (await import('node-fetch')).default;
        const FormData = (await import('form-data')).default;

        // Create form data
        const formData = new FormData();
        formData.append('video', fs.createReadStream(videoPath));
        formData.append('quality', '23');
        formData.append('resolution', 'original');
        formData.append('preset', 'medium');

        // Make API request
        const startTime = Date.now();

        const response = await fetch('http://localhost:3001/api/compress', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Compression failed');
        }

        // Save compressed video
        const outputPath = videoPath.replace(path.extname(videoPath), '_compressed_api.mp4');
        const buffer = await response.buffer();
        fs.writeFileSync(outputPath, buffer);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);

        // Results
        const outputStats = fs.statSync(outputPath);
        const savings = ((stats.size - outputStats.size) / stats.size * 100).toFixed(1);

        console.log('✅ Compression complete!\n');
        console.log('📊 Results:');
        console.log('   Original:   ', formatSize(stats.size));
        console.log('   Compressed: ', formatSize(outputStats.size));
        console.log('   Savings:    ', savings + '%');
        console.log('   Time:       ', duration + 's');
        console.log('   Output:     ', outputPath);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get video path from command line
const videoPath = process.argv[2];

if (!videoPath) {
    console.error('Usage: node test-api.js <path-to-video>');
    console.error('Example: node test-api.js videos/Bootcamp\\ Video\\ 1_v2.mp4');
    process.exit(1);
}

testAPI(videoPath);
