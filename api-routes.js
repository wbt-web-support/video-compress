const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { uploadCompressedVideo } = require('./bunny-cdn');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use high-resolution timestamp with random number for better uniqueness in simultaneous uploads
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const processId = process.pid || 0;
        const uniqueSuffix = `${timestamp}-${processId}-${random}`;
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1.5 * 1024 * 1024 * 1024 // 1.5GB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed.'));
        }
    }
});

/**
 * Helper function to get video duration in seconds
 */
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            const duration = metadata.format.duration;
            resolve(duration);
        });
    });
}

/**
 * Helper function to download video from URL
 */
async function downloadVideoFromURL(url) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Use high-resolution timestamp with random number for better uniqueness in simultaneous uploads
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const processId = process.pid || 0;
    const uniqueSuffix = `${timestamp}-${processId}-${random}`;
    const filename = `video-url-${uniqueSuffix}.mp4`;
    const filepath = path.join(uploadDir, filename);

    console.log('Downloading video from URL:', url);

    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 300000, // 5 minute timeout
        maxContentLength: 1.5 * 1024 * 1024 * 1024, // 1.5GB limit
        maxBodyLength: 1.5 * 1024 * 1024 * 1024
    });

    const writer = fs.createWriteStream(filepath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log('Download complete:', filepath);
            resolve({
                path: filepath,
                originalname: path.basename(url).split('?')[0] || 'video.mp4'
            });
        });
        writer.on('error', reject);
    });
}

/**
 * POST /api/compress
 * Compress a video file or video from URL
 *
 * Body (multipart/form-data or JSON):
 *   - video: Video file (optional if url provided)
 *   - url: Video URL (optional if video file provided)
 *   - quality: CRF value 18-28 (optional, default: 23)
 *   - resolution: Target resolution - original/1080/720 (optional, default: original)
 *   - preset: Encoding preset - fast/medium/slow (optional, default: medium)
 *   - uploadToCdn: Upload to Bunny CDN - true/false (optional, default: true if credentials configured)
 *   - format: Response format - json/file (optional, default: file)
 */
router.post('/compress', upload.single('video'), async (req, res) => {
    let inputPath;
    let originalName;
    let isFromURL = false;

    try {
        // Check if URL is provided
        if (req.body.url) {
            isFromURL = true;
            console.log('Processing video from URL...');

            const downloadedFile = await downloadVideoFromURL(req.body.url);
            inputPath = downloadedFile.path;
            originalName = downloadedFile.originalname;

        } else if (req.file) {
            // File upload
            inputPath = req.file.path;
            originalName = req.file.originalname;

        } else {
            return res.status(400).json({
                success: false,
                error: 'No video file or URL provided'
            });
        }

        // Check video duration (maximum 1.5 minutes)
        try {
            const duration = await getVideoDuration(inputPath);
            const maxDuration = 90; // 1.5 minutes in seconds
            
            if (duration > maxDuration) {
                cleanup(inputPath);
                return res.status(400).json({
                    success: false,
                    error: `Video duration is too long. Maximum duration is 1.5 minutes (${Math.round(duration)}s provided).`
                });
            }
            
            console.log(`Video duration: ${Math.round(duration)}s (valid)`);
        } catch (durationError) {
            console.error('Error getting video duration:', durationError);
            cleanup(inputPath);
            return res.status(400).json({
                success: false,
                error: 'Could not read video duration. Please ensure the file is a valid video.'
            });
        }

        const outputPath = inputPath.replace(path.extname(inputPath), '_compressed.mp4');

        // Get compression settings from request
        const quality = parseInt(req.body.quality) || 23;
        const resolution = req.body.resolution || 'original';
        const preset = req.body.preset || 'medium';

        // Validate settings
        if (quality < 18 || quality > 28) {
            throw new Error('Quality (CRF) must be between 18 and 28');
        }

        if (!['fast', 'medium', 'slow'].includes(preset)) {
            throw new Error('Preset must be fast, medium, or slow');
        }

        console.log(`Compressing: ${originalName}`);
        console.log(`Settings: CRF ${quality}, Resolution ${resolution}, Preset ${preset}`);

        // Get input file size
        const inputSize = fs.statSync(inputPath).size;

        // Build FFmpeg command
        let command = ffmpeg(inputPath)
            .videoCodec('libx264')
            .outputOptions([
                `-crf ${quality}`,
                `-preset ${preset}`,
                '-movflags +faststart'
            ])
            .audioCodec('aac')
            .audioBitrate('128k');

        // Handle resolution scaling
        if (resolution !== 'original') {
            const height = parseInt(resolution);
            command = command.size(`?x${height}`);
        }

        // Start compression with progress tracking
        command
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`Processing: ${Math.round(progress.percent)}% complete`);
                }
            })
            .on('end', async () => {
                const outputSize = fs.statSync(outputPath).size;
                const savings = ((inputSize - outputSize) / inputSize * 100).toFixed(1);

                console.log(`Compression complete!`);
                console.log(`Original: ${formatSize(inputSize)}`);
                console.log(`Compressed: ${formatSize(outputSize)}`);
                console.log(`Savings: ${savings}%`);

                // Upload to Bunny CDN if configured
                let bunnyCdnResult = null;
                const uploadToCdn = req.body.uploadToCdn !== 'false' && req.body.uploadToCdn !== false;
                const cdnFolder = req.body.cdnFolder || req.body.folder || 'compressed-videos';
                
                if (uploadToCdn) {
                    try {
                        console.log(`Uploading compressed video to Bunny CDN in folder: ${cdnFolder}...`);
                        bunnyCdnResult = await uploadCompressedVideo(outputPath, originalName, cdnFolder);
                        console.log('✅ Bunny CDN upload successful');
                    } catch (cdnError) {
                        console.error('⚠️ Bunny CDN upload failed:', cdnError.message);
                        // Continue even if CDN upload fails - still return the file
                    }
                }

                // Prepare response data
                const responseData = {
                    success: true,
                    originalSize: inputSize,
                    compressedSize: outputSize,
                    savings: `${savings}%`,
                    originalSizeFormatted: formatSize(inputSize),
                    compressedSizeFormatted: formatSize(outputSize),
                    fileName: originalName.replace(path.extname(originalName), '_compressed.mp4')
                };

                // Add Bunny CDN info if upload was successful
                if (bunnyCdnResult) {
                    const cdnUrl = bunnyCdnResult.cdnUrl || bunnyCdnResult.videoUrl;
                    // Replace domain in storagePath: wbt-public-videos.b-cdn.net -> wbt-public.b-cdn.net
                    const storagePath = cdnUrl.replace('wbt-public-videos.b-cdn.net', 'wbt-public.b-cdn.net');
                    responseData.bunnyCdn = {
                        cdnUrl: cdnUrl,
                        storagePath: storagePath,
                        videoId: bunnyCdnResult.videoId,
                        method: bunnyCdnResult.method
                    };
                }

                // If CDN upload was successful, always return JSON with video URL
                // Otherwise, check if client wants JSON response or file download
                const acceptHeader = req.headers.accept || '';
                const wantsJson = acceptHeader.includes('application/json') || req.query.format === 'json' || bunnyCdnResult;

                if (wantsJson || bunnyCdnResult) {
                    // Return JSON response with CDN URL or download link
                    res.json(responseData);
                    // Cleanup files after response
                    setTimeout(() => cleanup(inputPath, outputPath), 1000);
                } else {
                    // Send compressed file as download
                    res.download(outputPath, responseData.fileName, (err) => {
                        // Cleanup files after download
                        cleanup(inputPath, outputPath);

                        if (err) {
                            console.error('Download error:', err);
                        }
                    });
                }
            })
            .on('error', (err) => {
                console.error('Compression error:', err);
                cleanup(inputPath, outputPath);

                res.status(500).json({
                    success: false,
                    error: `Compression failed: ${err.message}`
                });
            })
            .save(outputPath);

    } catch (error) {
        console.error('Error:', error);
        cleanup(inputPath, outputPath);

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/info
 * Get API information and status
 */
router.get('/info', (req, res) => {
    res.json({
        success: true,
        name: 'Video Compressor API',
        version: '1.0.0',
        endpoints: {
            compress: {
                method: 'POST',
                path: '/api/compress',
                description: 'Compress a video file or video from URL',
                contentType: 'multipart/form-data or JSON',
                parameters: {
                    video: {
                        type: 'file',
                        required: false,
                        description: 'Video file to compress (MP4, MOV, AVI) - required if url not provided'
                    },
                    url: {
                        type: 'string',
                        required: false,
                        description: 'URL to video file (direct link or cloud storage) - required if video not provided'
                    },
                    quality: {
                        type: 'number',
                        required: false,
                        default: 23,
                        range: '18-28',
                        description: 'CRF value (18=high quality, 23=balanced, 28=max compression)'
                    },
                    resolution: {
                        type: 'string',
                        required: false,
                        default: 'original',
                        options: ['original', '1080', '720'],
                        description: 'Target resolution'
                    },
                    preset: {
                        type: 'string',
                        required: false,
                        default: 'medium',
                        options: ['fast', 'medium', 'slow'],
                        description: 'Encoding speed/quality preset'
                    },
                    uploadToCdn: {
                        type: 'boolean',
                        required: false,
                        default: true,
                        description: 'Upload compressed video to Bunny CDN (requires Bunny CDN credentials in .env)'
                    },
                    format: {
                        type: 'string',
                        required: false,
                        default: 'file',
                        options: ['file', 'json'],
                        description: 'Response format: file (download) or json (metadata with CDN URL)'
                    }
                },
                response: 'Binary video file (MP4) or JSON (if format=json)',
                maxFileSize: '1.5GB',
                note: 'Provide either a video file OR a URL, not both. Bunny CDN upload requires credentials in .env file.'
            }
        }
    });
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Helper function to cleanup files
function cleanup(...files) {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
                console.log(`Cleaned up: ${file}`);
            } catch (err) {
                console.error(`Failed to cleanup ${file}:`, err);
            }
        }
    });
}

// Helper function to format file sizes
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;
