const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/download', (req, res) => {
    const url = req.query.url;
    const type = req.query.type || 'video';

    if (!url) {
        return res.status(400).send('Missing URL');
    }

    console.log(`[${new Date().toISOString()}] Processing: ${url} | Type: ${type}`);

    let args = [];
    let mimeType = '';
    let disposition = '';

    if (type === 'audio') {
        args = [
            '-x',
            '--audio-format', 'mp3',
            '-o', '-',
            url
        ];
        mimeType = 'audio/mpeg';
        disposition = 'attachment; filename="audio.mp3"';
    } else {
        args = [
            '-f', 'best',
            '-o', '-',
            url
        ];
        mimeType = 'video/mp4';
        disposition = 'attachment; filename="video.mp4"';
    }

    res.header('Content-Type', mimeType);
    res.header('Content-Disposition', disposition);

    const ytDlp = spawn('yt-dlp', args);

    ytDlp.stdout.pipe(res);

    ytDlp.stderr.on('data', (data) => {
        console.error(`[LOG] ${data.toString()}`);
    });

    ytDlp.on('close', (code) => {
        console.log(`[${new Date().toISOString()}] Process finished with code ${code}`);
        if (code !== 0 && !res.headersSent) {
            res.status(500).send('Download failed. Check server logs.');
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
