/**
 * Test script for Video Compressor API with URL input
 *
 * Usage:
 *   node test-url-api.js <video-url>
 *
 * Example:
 *   node test-url-api.js https://example.com/video.mp4
 */

const fs = require('fs');
const path = require('path');

async function testURLAPI(videoURL) {
    console.log('🎬 Video Compressor API Test (URL Mode)\n');
    console.log('🔗 Video URL:', videoURL);
    console.log('🚀 Starting compression...\n');

    try {
        // Import fetch dynamically (Node 18+)
        const fetch = (await import('node-fetch')).default;
        const FormData = (await import('form-data')).default;

        // Create form data with URL
        const formData = new FormData();
        formData.append('url', videoURL);
        formData.append('quality', '23');
        formData.append('resolution', 'original');
        formData.append('preset', 'medium');

        // Make API request
        const startTime = Date.now();

        console.log('📥 Downloading and compressing video from URL...');

        const response = await fetch('http://localhost:3001/api/compress', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        // Save compressed video
        const outputPath = path.join(__dirname, 'compressed_from_url.mp4');
        const buffer = await response.buffer();
        fs.writeFileSync(outputPath, buffer);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);

        // Results
        const outputStats = fs.statSync(outputPath);

        console.log('\n✅ Compression complete!\n');
        console.log('📊 Results:');
        console.log('   Compressed size:', formatSize(outputStats.size));
        console.log('   Time:           ', duration + 's');
        console.log('   Output:         ', outputPath);
        console.log('\n✨ Video downloaded from URL and compressed successfully!');

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

// Get video URL from command line
const videoURL = process.argv[2];

if (!videoURL) {
    console.error('Usage: node test-url-api.js <video-url>');
    console.error('\nExample:');
    console.error('  node test-url-api.js https://example.com/sample-video.mp4');
    console.error('\nNote: Make sure the URL points to a direct video file (MP4, MOV, AVI)');
    process.exit(1);
}

testURLAPI(videoURL);
