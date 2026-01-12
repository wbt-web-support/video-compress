const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Bunny CDN Storage Upload Utility
 * 
 * Supports two methods:
 * 1. Bunny Storage - Direct file storage (recommended for simple file storage)
 * 2. Bunny Stream - Video streaming service (recommended for video delivery)
 */

/**
 * Upload file to Bunny Storage
 * @param {string} filePath - Local path to the file
 * @param {string} remotePath - Remote path in storage (e.g., 'videos/compressed-video.mp4')
 * @returns {Promise<Object>} Upload result with CDN URL
 */
async function uploadToBunnyStorage(filePath, remotePath) {
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storageZonePassword = process.env.BUNNY_STORAGE_ZONE_PASSWORD;
    const storageZoneRegion = process.env.BUNNY_STORAGE_ZONE_REGION || ''; // Empty = Frankfurt (default)
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;
    const pullZoneName = process.env.BUNNY_PULL_ZONE_NAME; // Optional: pull zone name (e.g., 'wbt-public')

    if (!storageZoneName || !storageZonePassword) {
        throw new Error('Bunny Storage credentials not configured. Please set BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_ZONE_PASSWORD in .env file');
    }

    // Normalize remote path (remove leading slash)
    const normalizedPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath;

    // Bunny Storage API endpoint - depends on primary storage region
    // See: https://docs.bunny.net/reference/storage-api
    // Regional endpoints:
    // - Frankfurt, DE: storage.bunnycdn.com (default)
    // - London, UK: uk.storage.bunnycdn.com
    // - New York, US: ny.storage.bunnycdn.com
    // - Los Angeles, US: la.storage.bunnycdn.com
    // - Singapore, SG: sg.storage.bunnycdn.com
    // - Stockholm, SE: se.storage.bunnycdn.com
    // - São Paulo, BR: br.storage.bunnycdn.com
    // - Johannesburg, SA: jh.storage.bunnycdn.com
    // - Sydney, SYD: syd.storage.bunnycdn.com
    let storageHost = 'storage.bunnycdn.com'; // Default: Frankfurt
    if (storageZoneRegion && storageZoneRegion.trim() !== '') {
        const region = storageZoneRegion.toLowerCase().trim();
        // Map region codes to storage hosts
        const regionMap = {
            'uk': 'uk.storage.bunnycdn.com',
            'london': 'uk.storage.bunnycdn.com',
            'ny': 'ny.storage.bunnycdn.com',
            'newyork': 'ny.storage.bunnycdn.com',
            'new york': 'ny.storage.bunnycdn.com',
            'la': 'la.storage.bunnycdn.com',
            'losangeles': 'la.storage.bunnycdn.com',
            'los angeles': 'la.storage.bunnycdn.com',
            'sg': 'sg.storage.bunnycdn.com',
            'singapore': 'sg.storage.bunnycdn.com',
            'se': 'se.storage.bunnycdn.com',
            'stockholm': 'se.storage.bunnycdn.com',
            'br': 'br.storage.bunnycdn.com',
            'saopaulo': 'br.storage.bunnycdn.com',
            'são paulo': 'br.storage.bunnycdn.com',
            'jh': 'jh.storage.bunnycdn.com',
            'johannesburg': 'jh.storage.bunnycdn.com',
            'syd': 'syd.storage.bunnycdn.com',
            'sydney': 'syd.storage.bunnycdn.com'
        };
        storageHost = regionMap[region] || `${region}.storage.bunnycdn.com`;
    }
    
    const uploadUrl = `https://${storageHost}/${storageZoneName}/${normalizedPath}`;

    console.log(`Uploading to Bunny Storage: ${uploadUrl}`);

    try {
        // Read file
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);

        // Upload file using PUT request with AccessKey header
        // Bunny Storage requires AccessKey header with Storage Zone password as value
        const response = await axios.put(uploadUrl, fileBuffer, {
            headers: {
                'AccessKey': storageZonePassword,
                'Content-Type': 'application/octet-stream'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Construct CDN URL
        // Format: https://{pullZoneName}.b-cdn.net/{normalizedPath}
        // Priority: pullZoneName > extract from pullZoneUrl > storageZoneName
        let cdnUrl;
        if (pullZoneName) {
            // Use pull zone name if provided (highest priority)
            cdnUrl = `https://${pullZoneName}.b-cdn.net/${normalizedPath}`;
        } else if (pullZoneUrl) {
            // Extract domain from pullZoneUrl if provided
            let baseUrl = pullZoneUrl.trim();
            // Remove trailing slash if present
            if (baseUrl.endsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }
            // Remove protocol if present
            baseUrl = baseUrl.replace(/^https?:\/\//, '');
            // Extract the subdomain (pull zone name) from the domain
            // e.g., "wbt-public.b-cdn.net" -> "wbt-public"
            const domainMatch = baseUrl.match(/^([^.]+)\.b-cdn\.net/);
            if (domainMatch) {
                const extractedName = domainMatch[1];
                cdnUrl = `https://${extractedName}.b-cdn.net/${normalizedPath}`;
            } else {
                // Fallback: use the full URL as-is
                cdnUrl = `https://${baseUrl}/${normalizedPath}`;
            }
        } else {
            // Fallback to storage zone name (may require pull zone setup)
            cdnUrl = `https://${storageZoneName}.b-cdn.net/${normalizedPath}`;
        }

        console.log(`✅ Upload successful! CDN URL: ${cdnUrl}`);

        return {
            success: true,
            cdnUrl: cdnUrl,
            storagePath: normalizedPath,
            fileName: fileName,
            method: 'storage'
        };

    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        const statusCode = error.response?.status;
        
        console.error('Bunny Storage upload error:', errorDetails);
        
        // Provide helpful error messages for common issues
        if (statusCode === 401) {
            throw new Error(`Bunny Storage authentication failed (401 Unauthorized). Please verify:
- BUNNY_STORAGE_ZONE_NAME matches your storage zone name exactly (case-sensitive)
- BUNNY_STORAGE_ZONE_PASSWORD is the password from "FTP & API Access" tab (not the API key)
- Get credentials from: Bunny.net Dashboard > Storage > Your Zone > FTP & API Access tab
- BUNNY_STORAGE_ZONE_REGION should match your storage zone's primary region (ny, uk, la, sg, se, br, jh, syd, or leave empty for Frankfurt)
- Find your region in: Bunny.net Dashboard > Storage > Your Zone > FTP & HTTP API Information
- Ensure there are no extra spaces or quotes in your .env file values`);
        } else if (statusCode === 404) {
            throw new Error(`Bunny Storage zone not found (404). Please verify BUNNY_STORAGE_ZONE_NAME: ${storageZoneName}`);
        } else {
            throw new Error(`Bunny Storage upload failed (${statusCode || 'unknown'}): ${error.response?.data?.Message || error.message}`);
        }
    }
}

/**
 * Upload video to Bunny Stream
 * @param {string} filePath - Local path to the video file
 * @param {string} videoTitle - Title for the video
 * @returns {Promise<Object>} Upload result with video ID and URL
 */
async function uploadToBunnyStream(filePath, videoTitle = null) {
    const streamApiKey = process.env.BUNNY_STREAM_API_KEY;
    const streamLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID;

    if (!streamApiKey || !streamLibraryId) {
        throw new Error('Bunny Stream credentials not configured. Please set BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID in .env file');
    }

    const fileName = path.basename(filePath);
    const title = videoTitle || fileName.replace(path.extname(fileName), '');

    console.log(`Uploading to Bunny Stream: ${title}`);

    try {
        // Step 1: Create video object
        const createVideoUrl = `https://video.bunnycdn.com/library/${streamLibraryId}/videos`;
        const createResponse = await axios.post(
            createVideoUrl,
            {
                title: title
            },
            {
                headers: {
                    'AccessKey': streamApiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        const videoId = createResponse.data.guid;
        console.log(`Video object created with ID: ${videoId}`);

        // Step 2: Upload video file
        const uploadVideoUrl = `https://video.bunnycdn.com/library/${streamLibraryId}/videos/${videoId}`;
        const fileBuffer = fs.readFileSync(filePath);

        const uploadResponse = await axios.put(
            uploadVideoUrl,
            fileBuffer,
            {
                headers: {
                    'AccessKey': streamApiKey,
                    'Accept': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        // Get video URL (may need to wait for processing)
        const videoUrl = `https://vz-${streamLibraryId}.b-cdn.net/${videoId}/play_720p.mp4`;

        console.log(`✅ Upload successful! Video ID: ${videoId}`);

        return {
            success: true,
            videoId: videoId,
            videoUrl: videoUrl,
            title: title,
            fileName: fileName,
            method: 'stream'
        };

    } catch (error) {
        console.error('Bunny Stream upload error:', error.response?.data || error.message);
        throw new Error(`Bunny Stream upload failed: ${error.response?.data?.Message || error.message}`);
    }
}

/**
 * Upload compressed video to Bunny CDN
 * Automatically chooses Storage or Stream based on available credentials
 * @param {string} filePath - Local path to compressed video
 * @param {string} originalFileName - Original file name for naming
 * @param {string} folder - Folder name in CDN storage (default: 'compressed-videos')
 * @returns {Promise<Object>} Upload result
 */
async function uploadCompressedVideo(filePath, originalFileName = null, folder = 'compressed-videos') {
    const fileName = originalFileName || path.basename(filePath);
    const baseName = fileName.replace(path.extname(fileName), '');
    const timestamp = Date.now();
    
    // Normalize folder name (remove leading/trailing slashes, replace spaces with hyphens)
    const normalizedFolder = folder.trim().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-') || 'compressed-videos';
    const remotePath = `${normalizedFolder}/${baseName}_${timestamp}.mp4`;

    // Check which service is configured
    const hasStorage = process.env.BUNNY_STORAGE_ZONE_NAME && process.env.BUNNY_STORAGE_ZONE_PASSWORD;
    const hasStream = process.env.BUNNY_STREAM_API_KEY && process.env.BUNNY_STREAM_LIBRARY_ID;

    if (!hasStorage && !hasStream) {
        throw new Error('No Bunny CDN credentials configured. Please set up either Bunny Storage or Bunny Stream in .env file');
    }

    // Prefer Storage over Stream (simpler for file storage)
    if (hasStorage) {
        return await uploadToBunnyStorage(filePath, remotePath);
    } else {
        return await uploadToBunnyStream(filePath, baseName);
    }
}

module.exports = {
    uploadToBunnyStorage,
    uploadToBunnyStream,
    uploadCompressedVideo
};
