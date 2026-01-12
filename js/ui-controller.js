export class UIController {
    constructor() {
        this.sections = {
            upload: document.getElementById('uploadSection'),
            progress: document.getElementById('progressSection'),
            results: document.getElementById('resultsSection'),
            error: document.getElementById('errorSection')
        };

        this.elements = {
            // Upload section
            uploadZone: document.getElementById('uploadZone'),
            settingsPanel: document.getElementById('settingsPanel'),
            previewFileName: document.getElementById('previewFileName'),
            previewFileSize: document.getElementById('previewFileSize'),

            // Progress section
            fileName: document.getElementById('fileName'),
            originalSize: document.getElementById('originalSize'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            statusMessage: document.getElementById('statusMessage'),

            // Results section
            resultOriginalSize: document.getElementById('resultOriginalSize'),
            resultCompressedSize: document.getElementById('resultCompressedSize'),
            savingsPercent: document.getElementById('savingsPercent'),

            // Error section
            errorMessage: document.getElementById('errorMessage')
        };

        this.currentFile = null;
        this.compressedBlob = null;
    }

    /**
     * Show specific section, hide others
     */
    showSection(sectionName) {
        Object.values(this.sections).forEach(section => {
            section.style.display = 'none';
        });

        if (this.sections[sectionName]) {
            this.sections[sectionName].style.display = 'block';
        }
    }

    /**
     * Show file selected state with settings
     */
    showFileSelected(file) {
        this.currentFile = file;
        document.getElementById('uploadZone').style.display = 'none';
        document.getElementById('urlInputZone').style.display = 'none';
        this.elements.settingsPanel.style.display = 'block';

        this.elements.previewFileName.textContent = file.name;
        this.elements.previewFileSize.textContent = file.url ? 'From URL' : this.formatSize(file.size);
    }

    /**
     * Reset to initial upload state
     */
    resetToUpload() {
        this.showSection('upload');
        this.elements.uploadZone.style.display = 'flex';
        this.elements.settingsPanel.style.display = 'none';
        this.currentFile = null;
        this.compressedBlob = null;
        this.resetProgress();
    }

    /**
     * Show compression progress
     */
    showProgress(file) {
        this.showSection('progress');
        this.elements.fileName.textContent = file.name;
        this.elements.originalSize.textContent = this.formatSize(file.size);
        this.updateProgress(0, 'Initializing...');
    }

    /**
     * Update progress bar and text
     */
    updateProgress(percentage, statusText = '') {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.elements.progressFill.style.width = `${clampedPercentage}%`;
        this.elements.progressText.textContent = `${clampedPercentage}%`;

        if (statusText) {
            this.elements.statusMessage.textContent = statusText;
        }
    }

    /**
     * Reset progress to 0
     */
    resetProgress() {
        this.updateProgress(0, 'Initializing...');
    }

    /**
     * Show compression results
     */
    showResults(originalSize, compressedBlob) {
        this.compressedBlob = compressedBlob;
        const compressedSize = compressedBlob.size;

        this.showSection('results');

        this.elements.resultOriginalSize.textContent = this.formatSize(originalSize);
        this.elements.resultCompressedSize.textContent = this.formatSize(compressedSize);

        const savings = ((originalSize - compressedSize) / originalSize) * 100;
        this.elements.savingsPercent.textContent = `${Math.round(savings)}%`;
    }

    /**
     * Show error message
     */
    showError(errorMessage) {
        this.showSection('error');
        this.elements.errorMessage.textContent = errorMessage;
    }

    /**
     * Download compressed video
     */
    downloadCompressedVideo() {
        if (!this.compressedBlob) {
            console.error('No compressed video available');
            return;
        }

        const url = URL.createObjectURL(this.compressedBlob);
        const a = document.createElement('a');
        a.href = url;

        // Generate filename
        const originalName = this.currentFile ? this.currentFile.name : 'video.mp4';
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        a.download = `${nameWithoutExt}_compressed.mp4`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Format bytes to human readable size
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Add drag-and-drop visual feedback
     */
    setupDragAndDrop(onDrop) {
        const uploadZone = this.elements.uploadZone;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add highlight on drag
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.remove('drag-over');
            }, false);
        });

        // Handle drop
        uploadZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                onDrop(files[0]);
            }
        }, false);
    }

    /**
     * Get compression settings from form
     */
    getCompressionSettings() {
        return {
            quality: parseInt(document.getElementById('qualityPreset').value),
            resolution: document.getElementById('resolution').value,
            speed: document.getElementById('speed').value
        };
    }
}
