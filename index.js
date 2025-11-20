const express = require('express');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- CÀI ĐẶT YT-DLP MỘT LẦN DUY NHẤT ---
const ytDlpPath = path.join(__dirname, 'yt-dlp');

function setupYtDlp() {
    if (fs.existsSync(ytDlpPath)) {
        console.log('✓ yt-dlp đã tồn tại. Bỏ qua bước tải.');
        return;
    }
    try {
        console.log('⬇ Đang tải yt-dlp mới nhất (chỉ làm 1 lần)...');
        execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${ytDlpPath}`);
        execSync(`chmod +x ${ytDlpPath}`);
        console.log('✓ Cài đặt xong.');
    } catch (e) {
        console.error('❌ Lỗi cài yt-dlp:', e.message);
    }
}
setupYtDlp();

// API: Lấy thông tin (Tối ưu cờ để chạy nhanh hơn)
app.post('/api/info', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Thiếu Link' });

    console.log(`[INFO] Đang check: ${url}`);

    // Dùng -J (dump-json) thay vì dump-single-json đôi khi nhanh hơn với playlist
    const process = spawn(ytDlpPath, [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificate',
        '--prefer-free-formats',
        url
    ]);

    let data = '';
    process.stdout.on('data', (chunk) => data += chunk);
    
    process.on('close', (code) => {
        if (code !== 0 || !data) return res.status(500).json({ error: 'Link lỗi hoặc Video riêng tư' });
        try {
            // Lấy dòng JSON đầu tiên (tránh trường hợp trả về nhiều dòng)
            const firstLine = data.split('\n')[0];
            const info = JSON.parse(firstLine);
            res.json({
                title: info.title,
                thumbnail: info.thumbnail,
                source: info.extractor_key
            });
        } catch (e) {
            res.status(500).json({ error: 'Không đọc được dữ liệu' });
        }
    });
});

// API: Lấy Link Video Trực Tiếp (Không qua server -> Siêu nhanh)
app.post('/api/get-video', (req, res) => {
    const { url } = req.body;
    const process = spawn(ytDlpPath, [
        '-g', 
        '-f', 'b[ext=mp4]/b', // Ưu tiên MP4 tốt nhất
        '--no-warnings',
        url
    ]);

    let directLink = '';
    process.stdout.on('data', (c) => directLink += c);

    process.on('close', (code) => {
        if (code === 0 && directLink) {
            res.json({ url: directLink.trim() });
        } else {
            res.status(500).json({ error: 'Không lấy được link video' });
        }
    });
});

// API: Stream Audio GỐC (M4A/AAC) - Nhanh, nhẹ, không convert
app.get('/api/audio-fast', (req, res) => {
    const url = req.query.url;
    // Đặt tên file là .m4a để trình duyệt hiểu
    res.header('Content-Disposition', `attachment; filename="audio_fast.m4a"`);
    res.header('Content-Type', 'audio/mp4');

    // Lấy stream audio nhẹ nhất và pipe thẳng về (không convert sang mp3)
    const args = [
        '--no-check-certificate',
        '--no-warnings',
        '-f', 'ba[ext=m4a]/ba', // Best Audio (thường là m4a)
        '-o', '-', // Output stdout
        url
    ];

    const process = spawn(ytDlpPath, args);
    process.stdout.pipe(res);
    
    // Xử lý khi user hủy tải giữa chừng để không treo server
    req.on('close', () => {
        process.kill('SIGKILL');
    });
});

// API: Stream Audio MP3 (Convert) - Chậm hơn nhưng đúng chuẩn MP3
app.get('/api/audio-mp3', (req, res) => {
    const url = req.query.url;
    res.header('Content-Disposition', `attachment; filename="audio_convert.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const args = [
        '--no-check-certificate',
        '--no-warnings',
        '-f', 'ba', // Best audio
        '-x', // Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '128K', // Giảm bitrate xuống 128k để convert nhanh hơn
        '-o', '-', 
        url
    ];

    const process = spawn(ytDlpPath, args);
    process.stdout.pipe(res);

    req.on('close', () => {
        process.kill('SIGKILL');
    });
});

app.listen(port, () => console.log(`🚀 Server V3 chạy tại port ${port}`));
