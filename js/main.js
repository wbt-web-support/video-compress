import { FFmpegEngine } from './ffmpeg-engine.js';
import { UIController } from './ui-controller.js';

class VideoCompressorApp {
    constructor() {
        this.engine = new FFmpegEngine();
        this.ui = new UIController();
        this.currentFile = null;
        this.isProcessing = false;

        this.initializeEventListeners();
        this.checkBrowserCompatibility();
    }

    /**
     * Set up all event listeners
     */
    initializeEventListeners() {
        // Tab switching
        this.setupTabSwitching();

        // Upload mode toggle (File vs URL)
        document.getElementById('fileModeBtn').addEventListener('click', () => {
            this.switchUploadMode('file');
        });

        document.getElementById('urlModeBtn').addEventListener('click', () => {
            this.switchUploadMode('url');
        });

        // URL submit button
        document.getElementById('urlSubmitBtn').addEventListener('click', () => {
            const url = document.getElementById('urlInput').value.trim();
            if (url) {
                this.handleURLInput(url);
            } else {
                alert('Please enter a valid video URL');
            }
        });

        // File input and upload zone
        const fileInput = document.getElementById('fileInput');
        const uploadZone = document.getElementById('uploadZone');

        uploadZone.addEventListener('click', () => {
            if (!this.isProcessing) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Set up drag and drop
        this.ui.setupDragAndDrop((file) => this.handleFileSelect(file));

        // Start compression button
        document.getElementById('startCompressionBtn').addEventListener('click', () => {
            this.startCompression();
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.cancelCompression();
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.ui.downloadCompressedVideo();
        });

        // Compress another button
        document.getElementById('compressAnotherBtn').addEventListener('click', () => {
            this.reset();
        });

        // Try again button (error state)
        document.getElementById('tryAgainBtn').addEventListener('click', () => {
            this.reset();
        });
    }

    /**
     * Set up tab switching functionality
     */
    setupTabSwitching() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.getAttribute('data-tab');

                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Show corresponding tab content
                tabContents.forEach(tab => {
                    tab.classList.remove('active');
                });

                const targetTabContent = document.getElementById(`${targetTab}Tab`);
                if (targetTabContent) {
                    targetTabContent.classList.add('active');
                }
            });
        });
    }

    /**
     * Check browser compatibility
     */
    checkBrowserCompatibility() {
        // Check for SharedArrayBuffer
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn('SharedArrayBuffer not available. Multi-threading will be disabled (slower compression).');
            console.warn('Make sure the page is served with proper COOP/COEP headers.');
        }

        // Check for modern browser features
        if (!window.Worker || !window.Blob || !window.URL) {
            this.ui.showError('Your browser is not supported. Please use a modern browser (Chrome, Firefox, Edge, Safari).');
        }
    }

    /**
     * Get video duration in seconds
     */
    async getVideoDuration(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            
            video.onerror = () => {
                window.URL.revokeObjectURL(video.src);
                reject(new Error('Could not read video duration'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(file) {
        if (this.isProcessing) {
            return;
        }

        try {
            // Validate file
            FFmpegEngine.validateFile(file);

            // Check video duration (maximum 1.5 minutes)
            try {
                const duration = await this.getVideoDuration(file);
                const maxDuration = 90; // 1.5 minutes in seconds
                
                if (duration > maxDuration) {
                    const durationMinutes = (duration / 60).toFixed(1);
                    alert(`Video duration is too long!\n\nMaximum duration: 1.5 minutes\nYour video Duration: ${durationMinutes} minutes\n\nPlease upload a video that is 1.5 minutes or less.`);
                    return;
                }
            } catch (durationError) {
                console.warn('Could not read video duration:', durationError);
                // Continue anyway, backend will validate
            }

            this.currentFile = file;
            this.ui.showFileSelected(file);

        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    /**
     * Start video compression
     */
    async startCompression() {
        if (!this.currentFile || this.isProcessing) {
            return;
        }

        // Double-check duration before starting compression
        try {
            const duration = await this.getVideoDuration(this.currentFile);
            const maxDuration = 90; // 1.5 minutes in secondsgi
            
            if (duration > maxDuration) {
                const durationMinutes = (duration / 60).toFixed(1);
                alert(`Video duration is too long!\n\nMaximum duration: 1.5 minutes\nYour video Duration: ${durationMinutes} minutes\n\nPlease upload a video that is 1.5 minutes or less.`);
                return;
            }
        } catch (durationError) {
            console.warn('Could not read video duration:', durationError);
            // Continue anyway, backend will validate
        }

        this.isProcessing = true;
        const originalSize = this.currentFile.size;

        try {
            // Get compression settings from UI
            const settings = this.ui.getCompressionSettings();

            // Show progress screen
            this.ui.showProgress(this.currentFile);

            // Set up progress callbacks
            this.engine.onProgress((percentage, time) => {
                this.ui.updateProgress(percentage);
            });

            this.engine.onStatus((message) => {
                this.ui.updateProgress(
                    parseInt(this.ui.elements.progressText.textContent) || 0,
                    message
                );
            });

            // Start compression
            console.log('Starting compression with settings:', settings);
            const startTime = Date.now();

            const compressedBlob = await this.engine.compress(this.currentFile, settings);

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(1);

            console.log(`Compression complete in ${duration}s`);
            console.log(`Original: ${FFmpegEngine.formatSize(originalSize)}`);
            console.log(`Compressed: ${FFmpegEngine.formatSize(compressedBlob.size)}`);
            console.log(`Savings: ${Math.round((1 - compressedBlob.size / originalSize) * 100)}%`);

            // Show results
            this.ui.showResults(originalSize, compressedBlob);

        } catch (error) {
            console.error('Compression error:', error);

            if (error.message === 'Compression cancelled') {
                this.reset();
            } else {
                this.ui.showError(error.message || 'An error occurred during compression. Please try again.');
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Cancel ongoing compression
     */
    async cancelCompression() {
        if (!this.isProcessing) {
            return;
        }

        if (confirm('Are you sure you want to cancel the compression?')) {
            await this.engine.cancel();
            this.isProcessing = false;
        }
    }

    /**
     * Reset app to initial state
     */
    reset() {
        this.currentFile = null;
        this.isProcessing = false;
        this.ui.resetToUpload();

        // Clear file input
        const fileInput = document.getElementById('fileInput');
        fileInput.value = '';

        // Clear URL input
        const urlInput = document.getElementById('urlInput');
        urlInput.value = '';
    }

    /**
     * Switch between file upload and URL input modes
     */
    switchUploadMode(mode) {
        const uploadZone = document.getElementById('uploadZone');
        const urlInputZone = document.getElementById('urlInputZone');
        const fileModeBtn = document.getElementById('fileModeBtn');
        const urlModeBtn = document.getElementById('urlModeBtn');

        if (mode === 'file') {
            uploadZone.style.display = 'flex';
            urlInputZone.style.display = 'none';
            fileModeBtn.classList.add('active');
            urlModeBtn.classList.remove('active');
        } else if (mode === 'url') {
            uploadZone.style.display = 'none';
            urlInputZone.style.display = 'flex';
            fileModeBtn.classList.remove('active');
            urlModeBtn.classList.add('active');
        }
    }

    /**
     * Handle URL input for video
     */
    async handleURLInput(url) {
        if (this.isProcessing) {
            return;
        }

        try {
            // Basic URL validation
            new URL(url);

            // Create a mock file object for the URL
            this.currentFile = {
                name: url.split('/').pop().split('?')[0] || 'video.mp4',
                size: 0, // Size unknown until downloaded
                url: url
            };

            this.ui.showFileSelected(this.currentFile);

        } catch (error) {
            alert('Invalid URL. Please enter a valid video URL.');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 Video Compressor App initialized');
    new VideoCompressorApp();
});
