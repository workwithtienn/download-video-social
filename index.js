const express = require('express');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });

        res.json({
            title: output.title,
            thumbnail: output.thumbnail,
            duration: output.duration,
            source: output.extractor_key
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch video info. Ensure the link is public.' });
    }
});

app.get('/api/download', async (req, res) => {
    const { url, type } = req.query;

    if (!url || !type) return res.status(400).send('Missing parameters');

    try {
        const isAudio = type === 'audio';
        
        res.header('Content-Disposition', `attachment; filename="download.${isAudio ? 'mp3' : 'mp4'}"`);
        res.header('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

        const flags = {
            noCheckCertificates: true,
            noWarnings: true,
            output: '-'
        };

        if (isAudio) {
            flags.extractAudio = true;
            flags.audioFormat = 'mp3';
        } else {
            flags.format = 'best[ext=mp4]';
        }

        const subprocess = youtubedl.exec(url, flags);

        subprocess.stdout.pipe(res);
        
        subprocess.stderr.on('data', (data) => {
            console.log(`Progress: ${data.toString()}`);
        });

        subprocess.on('close', () => {
            res.end();
        });

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send('Download failed');
        }
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
