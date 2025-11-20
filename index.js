const express = require('express');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Tự động cài đặt yt-dlp binary mới nhất ---
const ytDlpPath = path.join(__dirname, 'yt-dlp');
try {
    if (!fs.existsSync(ytDlpPath)) {
        console.log('Downloading latest yt-dlp...');
        execSync(`wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ${ytDlpPath}`);
        execSync(`chmod +x ${ytDlpPath}`);
        console.log('yt-dlp installed successfully.');
    }
} catch (e) {
    console.error('Error installing yt-dlp:', e);
}

app.use(express.json());
app.use(express.static('public'));

// API: Lấy thông tin Video
app.post('/api/info', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    // Lấy JSON info nhanh
    const process = spawn(ytDlpPath, [
        '--dump-single-json',
        '--no-warnings',
        '--no-check-certificate',
        url
    ]);

    let data = '';
    process.stdout.on('data', (chunk) => data += chunk);
    
    process.on('close', (code) => {
        if (code !== 0 || !data) return res.status(500).json({ error: 'Invalid link or Private video' });
        try {
            const info = JSON.parse(data);
            res.json({
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration_string,
                extractor: info.extractor_key
            });
        } catch (e) {
            res.status(500).json({ error: 'Parse error' });
        }
    });
});

// API: Lấy Link tải trực tiếp cho VIDEO (Siêu nhanh)
app.post('/api/get-video-link', (req, res) => {
    const { url } = req.body;
    // Lấy direct URL (-g) thay vì tải file về server
    const process = spawn(ytDlpPath, [
        '-g', 
        '-f', 'best[ext=mp4]/best', // Ưu tiên MP4
        '--no-warnings',
        url
    ]);

    let directLink = '';
    process.stdout.on('data', (chunk) => directLink += chunk);

    process.on('close', (code) => {
        if (code === 0 && directLink) {
            res.json({ downloadUrl: directLink.trim() });
        } else {
            res.status(500).json({ error: 'Could not fetch video link' });
        }
    });
});

// API: Stream Audio MP3 (Xử lý convert chuẩn)
app.get('/api/stream-audio', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('No URL');

    const filename = 'audio_track.mp3';
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'audio/mpeg');

    // Lệnh này lấy source "bestaudio" (nhẹ nhất) -> pipe sang ffmpeg -> mp3
    // Đảm bảo file nhẹ và đúng định dạng
    const args = [
        '--no-check-certificate',
        '--no-warnings',
        '-f', 'bestaudio/best', // Chỉ tải luồng âm thanh (nhẹ hều)
        '-x', // Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '0', // Chất lượng tốt nhất
        '-o', '-', // Output ra stdout
        url
    ];

    const process = spawn(ytDlpPath, args);

    // Pipe dữ liệu thẳng xuống trình duyệt người dùng
    process.stdout.pipe(res);

    process.stderr.on('data', (d) => console.log(`[Audio Log]: ${d}`));
    
    process.on('close', () => res.end());
});

app.listen(port, () => console.log(`Server ready at ${port}`));
