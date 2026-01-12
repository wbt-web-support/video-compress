# Video Compressor

A web-based video compressor optimized for phone-recorded videos (100MB-1GB). Compress videos directly in your browser with no server uploads required.

## Features

- **Client-Side Processing**: All compression happens in your browser - no files uploaded to servers
- **Large File Support**: Handle videos from 100MB to 1GB
- **Excellent Compression**: 75-85% size reduction with minimal quality loss
- **Multi-threading**: 2x faster compression with SharedArrayBuffer support
- **Phone Video Optimized**: Perfect for compressing large phone recordings
- **User-Friendly**: Simple drag-and-drop interface with real-time progress
- **Privacy First**: Videos never leave your device

## Features

- Drag-and-drop or click to upload videos
- Adjustable quality settings (High, Balanced, Maximum Compression)
- Resolution control (Keep original, 1080p, 720p)
- Real-time progress tracking
- 75-85% file size reduction on average
- No file uploads - everything happens in your browser
- Works offline after initial load

## Quick Start

### Local Development

1. **Install Dependencies:**
```bash
npm install
```

2. **Start Development Server:**
```bash
npm run dev
```

3. **Access the Application:**
- **Web UI:** http://localhost:3001
- **API:** http://localhost:3001/api

**Important:** The development server is configured with the required headers for multi-threading support (SharedArrayBuffer).

## Two Ways to Use

### 1. Web Interface (Browser-Based)
- Open http://localhost:3001 in your browser
- Drag and drop videos directly
- All processing happens in your browser
- No server uploads required

### 2. API (Server-Side)
- Send videos to `/api/compress` endpoint
- Server-side compression with FFmpeg
- Perfect for integrating into applications
- See API documentation below

## API Documentation

### Endpoint: Compress Video

```
POST /api/compress
```

Compress a video file using server-side FFmpeg.

#### Parameters (multipart/form-data)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `video` | file | Yes | - | Video file (MP4, MOV, AVI) |
| `quality` | number | No | 23 | CRF value (18-28). Lower = higher quality |
| `resolution` | string | No | original | Target resolution: `original`, `1080`, `720` |
| `preset` | string | No | medium | Encoding speed: `fast`, `medium`, `slow` |

#### Response
Returns the compressed video file as binary data (video/mp4).

#### Example: cURL
```bash
curl -X POST http://localhost:3001/api/compress \
  -F "video=@/path/to/video.mp4" \
  -F "quality=23" \
  -F "resolution=1080" \
  -F "preset=medium" \
  -o compressed_video.mp4
```

#### Example: JavaScript
```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);
formData.append('quality', '23');
formData.append('resolution', '1080');
formData.append('preset', 'medium');

const response = await fetch('http://localhost:3001/api/compress', {
  method: 'POST',
  body: formData
});

const blob = await response.blob();
// Download the compressed video
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'compressed_video.mp4';
a.click();
```

#### Example: Python
```python
import requests

with open('video.mp4', 'rb') as f:
    files = {'video': f}
    data = {
        'quality': '23',
        'resolution': '1080',
        'preset': 'medium'
    }

    response = requests.post(
        'http://localhost:3001/api/compress',
        files=files,
        data=data
    )

    with open('compressed_video.mp4', 'wb') as out:
        out.write(response.content)
```

#### Test the API
We've included a test script:
```bash
node test-api.js videos/Bootcamp\ Video\ 1_v2.mp4
```

### Other API Endpoints

#### Get API Info
```
GET /api/info
```
Returns API information and available endpoints.

#### Health Check
```
GET /api/health
```
Returns server health status.

## How the Browser Version Works

1. **Upload** - Drag and drop or click to select a video file (100MB-1GB)
2. **Configure** - Choose quality, resolution, and speed settings
3. **Compress** - Processing happens entirely in your browser (no upload to server)
4. **Download** - Get your compressed video file

## Features

- **Browser-based**: All processing happens locally, no server uploads
- **Multi-threaded**: Uses FFmpeg.wasm with multi-threading for 2x faster compression
- **High Quality**: Uses CRF encoding for excellent quality at smaller file sizes
- **Optimized for Phone Videos**: Perfect for compressing 100MB-1GB phone recordings
- **Customizable**: Adjust quality, resolution, and speed settings
- **Privacy First**: No files are uploaded to any server
- **Mobile-Friendly**: Responsive design works on all devices

## Expected Results

- **Compression Ratio**: 75-85% size reduction
- **Example**: 850MB video → 150-200MB compressed
- **Quality**: Excellent visual quality maintained (CRF 23)
- **Speed**:
  - 100MB: ~1-2 minutes
  - 500MB: ~5-8 minutes
  - 1GB: ~10-15 minutes

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Modern browser (Chrome, Firefox, Edge, or Safari)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

   The dev server automatically sets the required headers for multi-threading support.

### Important: COOP/COEP Headers

For multi-threaded compression (2x faster), the following headers are required:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These headers enable `SharedArrayBuffer`, which FFmpeg.wasm needs for multi-threading.

## How It Works

1. **Upload**: Drag and drop or click to select a video file (100MB-1GB)
2. **Configure**: Choose quality, resolution, and speed settings
3. **Compress**: Click "Start Compression" and wait
4. **Download**: Get your compressed video (typically 75-85% smaller)

All processing happens **in your browser** - no files are uploaded to any server!

## Compression Settings

### Quality (CRF)
- **High Quality (CRF 20)**: Larger file size, visually lossless
- **Balanced (CRF 23)**: Recommended for most use cases (default)
- **Maximum Compression (CRF 28)**: Smaller file, slight quality loss

### Resolution
- **Keep Original**: Maintains source resolution
- **1080p**: Scales down 4K videos to Full HD
- **720p**: Maximum compression, good for mobile viewing

### Speed/Quality
- **Fast**: Faster compression, slightly lower quality
- **Medium**: Balanced (recommended)
- **Slow**: Slower compression, slightly better quality

## Expected Results

- 850MB 1080p video → 150-200MB (82% smaller)
- 450MB 720p video → 80-120MB (78% smaller)
- Processing time: 1-2 min (100MB), 5-8 min (500MB), 10-15 min (1GB)

## Browser Support

- Chrome/Edge: ✅ Full support with multi-threading
- Firefox: ✅ Full support with multi-threading
- Safari: ✅ Supported (may be slower without multi-threading)

## Deployment

### Cloudflare Pages (Recommended)
1. Push your code to GitHub
2. Connect repository to Cloudflare Pages
3. Deploy - headers are automatically applied from `_headers` file
4. Multi-threading will work automatically!

### Netlify
Create `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

### Vercel
Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

## How It Works

1. **Upload**: Drag and drop or click to select a video file (100MB-1GB)
2. **Configure**: Choose quality, resolution, and speed settings
3. **Compress**: FFmpeg.wasm processes the video in your browser
4. **Download**: Get your compressed video (typically 75-85% smaller)

## Compression Settings

### Quality (CRF)
- **High Quality (CRF 20)**: Larger file size, best visual quality
- **Balanced (CRF 23)**: Recommended - excellent quality, 75-85% size reduction
- **Maximum Compression (CRF 28)**: Smaller files, slight quality loss

### Resolution
- **Keep Original**: Maintains source resolution
- **1080p**: Scales down to Full HD (great for most phones)
- **720p**: Smaller file size, good for sharing

### Speed/Quality Preset
- **Fast**: Quicker compression, slightly larger files
- **Medium**: Balanced (recommended)
- **Slow**: Better compression, takes longer

## Expected Results

For typical phone videos:
- **850MB 1080p video** → 150-200MB (82% smaller)
- **450MB 720p video** → 80-120MB (78% smaller)
- **2GB 4K video** → 350-450MB (80% smaller)

Compression time (desktop with multi-threading):
- 100MB: ~1-2 minutes
- 500MB: ~5-8 minutes
- 1GB: ~10-15 minutes

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

**Important:** The dev server sets required headers for SharedArrayBuffer (multi-threading support).

## Usage

1. **Upload Video**
   - Drag and drop a video file, or click to browse
   - Supported formats: MP4, MOV, AVI
   - File size: 1MB - 1.5GB

2. **Adjust Settings**
   - **Quality**: High (CRF 20), Balanced (CRF 23), or Maximum Compression (CRF 28)
   - **Resolution**: Keep original, 1080p, or 720p
   - **Speed**: Fast, Medium (recommended), or Slow

3. **Start Compression**
   - Click "Start Compression"
   - Watch real-time progress
   - Cancel anytime if needed

4. **Download**
   - View compression results (original vs compressed size)
   - Download compressed video
   - Compress another video

## How It Works

- **100% Browser-Based**: All processing happens in your browser using FFmpeg.wasm
- **No Server Uploads**: Your videos never leave your computer
- **Multi-Threading**: Uses SharedArrayBuffer for 2x faster compression
- **Smart Compression**: Uses CRF (Constant Rate Factor) for consistent quality
- **Expected Results**: 75-85% size reduction for phone videos

## Expected Performance

### Compression Time (Multi-threaded)
- 100MB video: 1-2 minutes
- 500MB video: 5-8 minutes
- 1GB video: 10-15 minutes

### File Size Reduction
- 850MB 1080p → 150-200MB (82% smaller)
- 450MB 720p → 80-120MB (78% smaller)
- 2GB 4K → 350-450MB (80% smaller, downscaled to 1080p)

## Browser Compatibility

### Fully Supported (Multi-threaded)
- Chrome 92+
- Edge 92+
- Firefox 89+

### Partial Support (Single-threaded, slower)
- Safari 15+ (works but slower due to limited SharedArrayBuffer support)

### Requirements
- Modern browser with JavaScript enabled
- Minimum 4GB RAM recommended for 1GB files
- Good internet connection for initial FFmpeg library load (~30-40MB)

## Deployment

### Deploy to Cloudflare Pages

1. Push your code to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com)
3. Connect your repository
4. Deploy!

The `_headers` file is already configured with required headers for SharedArrayBuffer support.

### Deploy to Netlify

Create `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

### Deploy to Vercel

Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

## Troubleshooting

### Compression is slow
- Make sure you're using a modern browser (Chrome/Edge recommended)
- Check if SharedArrayBuffer is enabled (console will show warning if not)
- Ensure proper headers are set (see Deployment section)
- Close other tabs to free up memory

### Out of memory error
- Try compressing a smaller file first
- Close other applications
- Use lower resolution setting (720p instead of 1080p)
- Recommended: 8GB+ RAM for 1GB files

### FFmpeg fails to load
- Check your internet connection (needs to download ~30-40MB)
- Try refreshing the page
- Clear browser cache and try again

### Video doesn't play after compression
- Try a different video player
- Ensure original video wasn't corrupted
- Re-compress with "Slow" speed setting for better compatibility

## Technical Details

### Compression Settings

**CRF (Constant Rate Factor)**
- CRF 18: Visually lossless (largest files)
- CRF 23: Excellent quality (recommended)
- CRF 28: Good quality (maximum compression)

**FFmpeg Command Used**
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -crf 23 \
  -preset medium \
  -movflags +faststart \
  -c:a aac \
  -b:a 128k \
  -threads 0 \
  output.mp4
```

### Why Browser-Based Compression?

**Pros:**
- Privacy: Files never leave your device
- No server costs
- No upload/download time
- Works offline (after initial load)

**Cons:**
- Slower than server-side (10-15 min for 1GB vs 2-3 min on server)
- Requires good hardware (4GB+ RAM recommended)
- Initial library load required (~30-40MB)

## Future Enhancements

- WebCodecs API support (3x faster, hardware accelerated)
- Batch processing (multiple videos at once)
- Quality preview before full compression
- Trim/crop video before compression
- Custom bitrate control
- More output formats (WebM, AV1)

## License

MIT License - Feel free to use, modify, and distribute!

## Credits

Built with:
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) - WebAssembly port of FFmpeg
- Vanilla JavaScript (no frameworks!)

---

Made for compressing phone-recorded videos directly in your browser.
