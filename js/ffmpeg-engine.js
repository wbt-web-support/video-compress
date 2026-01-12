import { FFmpeg } from '../node_modules/@ffmpeg/ffmpeg/dist/esm/index.js';
import { fetchFile, toBlobURL } from '../node_modules/@ffmpeg/util/dist/esm/index.js';

export class FFmpegEngine {
    constructor() {
        this.ffmpeg = null;
        this.loaded = false;
        this.cancelled = false;
        this.progressCallback = null;
        this.statusCallback = null;
    }

    /**
     * Initialize FFmpeg with multi-threading support
     */
    async initialize() {
        if (this.loaded) return;

        this.ffmpeg = new FFmpeg();

        // Set up logging
        this.ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        // Set up progress tracking
        this.ffmpeg.on('progress', ({ progress, time }) => {
            const percentage = Math.round(progress * 100);
            if (this.progressCallback) {
                this.progressCallback(percentage, time);
            }
        });

        try {
            // Check if SharedArrayBuffer is available for multi-threading
            const supportsMultiThread = typeof SharedArrayBuffer !== 'undefined';

            if (supportsMultiThread) {
                // Load multi-threaded version
                const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
                });
                this.updateStatus('Multi-threaded FFmpeg loaded (2x faster)');
            } else {
                // Fallback to single-threaded version
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
                });
                this.updateStatus('Single-threaded FFmpeg loaded');
                console.warn('SharedArrayBuffer not available. Using single-threaded mode (slower).');
            }

            this.loaded = true;
            this.updateStatus('Ready to compress');
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw new Error('Failed to initialize FFmpeg. Please check your internet connection and try again.');
        }
    }

    /**
     * Compress video with specified settings
     * @param {File} file - Input video file
     * @param {Object} options - Compression options
     * @returns {Promise<Blob>} - Compressed video blob
     */
    async compress(file, options = {}) {
        if (!this.loaded) {
            await this.initialize();
        }

        this.cancelled = false;

        // Default settings (optimized for phone videos)
        const settings = {
            crf: options.quality || 23,           // CRF value (18-28)
            preset: options.speed || 'medium',    // Encoding preset
            resolution: options.resolution || 'original',  // Target resolution
            audioBitrate: '128k'                  // Audio bitrate
        };

        try {
            // Write input file to FFmpeg virtual filesystem
            this.updateStatus('Loading video...');
            const inputName = 'input.mp4';
            const outputName = 'output.mp4';

            await this.ffmpeg.writeFile(inputName, await fetchFile(file));

            if (this.cancelled) {
                await this.cleanup(inputName, outputName);
                throw new Error('Compression cancelled');
            }

            // Build FFmpeg command
            const command = this.buildCommand(inputName, outputName, settings);

            this.updateStatus('Compressing video...');
            console.log('FFmpeg command:', command.join(' '));

            // Execute compression
            await this.ffmpeg.exec(command);

            if (this.cancelled) {
                await this.cleanup(inputName, outputName);
                throw new Error('Compression cancelled');
            }

            // Read compressed file
            this.updateStatus('Finalizing...');
            const data = await this.ffmpeg.readFile(outputName);

            // Create blob
            const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

            // Cleanup
            await this.cleanup(inputName, outputName);

            this.updateStatus('Complete!');
            return compressedBlob;

        } catch (error) {
            if (error.message === 'Compression cancelled') {
                throw error;
            }
            console.error('Compression error:', error);
            throw new Error(`Compression failed: ${error.message}`);
        }
    }

    /**
     * Build FFmpeg command based on settings
     */
    buildCommand(inputName, outputName, settings) {
        const command = [
            '-i', inputName,
            '-c:v', 'libx264',
            '-crf', settings.crf.toString(),
            '-preset', settings.preset,
            '-movflags', '+faststart'
        ];

        // Handle resolution scaling
        if (settings.resolution !== 'original') {
            const height = parseInt(settings.resolution);
            command.push('-vf', `scale=-2:${height}`);
        }

        // Audio settings
        command.push(
            '-c:a', 'aac',
            '-b:a', settings.audioBitrate,
            '-threads', '0'  // Use all available threads
        );

        command.push(outputName);

        return command;
    }

    /**
     * Cancel ongoing compression
     */
    async cancel() {
        this.cancelled = true;
        this.updateStatus('Cancelling...');
        // FFmpeg doesn't have a direct cancel method, but we check this.cancelled flag
    }

    /**
     * Clean up temporary files
     */
    async cleanup(inputName, outputName) {
        try {
            const files = await this.ffmpeg.listDir('/');
            if (files.some(f => f.name === inputName)) {
                await this.ffmpeg.deleteFile(inputName);
            }
            if (files.some(f => f.name === outputName)) {
                await this.ffmpeg.deleteFile(outputName);
            }
        } catch (error) {
            console.warn('Cleanup warning:', error);
        }
    }

    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Set status callback
     */
    onStatus(callback) {
        this.statusCallback = callback;
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        if (this.statusCallback) {
            this.statusCallback(message);
        }
    }

    /**
     * Format file size for display
     */
    static formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Validate file before compression
     */
    static validateFile(file) {
        const maxSize = 1.5 * 1024 * 1024 * 1024; // 1.5GB safety limit
        const minSize = 1 * 1024 * 1024; // 1MB minimum

        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 1.5GB.');
        }

        if (file.size < minSize) {
            throw new Error('File too small. Minimum size is 1MB.');
        }

        // Check file type
        if (!file.type.startsWith('video/')) {
            throw new Error('Invalid file type. Please select a video file.');
        }

        return true;
    }
}
