const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const openai = require('openai');
const fileUpload = require('express-fileupload');
const FormData = require('form-data');

if(process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.config();
}

openai.apiKey = process.env.OPENAI_API_KEY;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.get('/', async (req, res) => {
    if (req.query.url) {
        const proxyRes = await axios.get(req.query.url);
        res.send(proxyRes.data);
    } else {
        res.send('Please provide a url');
    }
});

function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

app.post('/transcribe', async (req, res) => {
    console.log('Transcribe endpoint hit');

    // Log the Incoming Content-Type
    console.log("Incoming Content-Type:", req.headers['content-type']);

    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            console.log('No files received');
            return res.status(400).send('No files were uploaded.');
        }

        let audioFile = req.files.audio;// Assuming "audio" is the field name in your form

        // fs.writeFileSync('testFile.webm', audioFile.data); //remeber to remove in prod

        // Log details of the uploaded file
        console.log("Uploaded File Name:", audioFile.name);
        console.log("Uploaded File MIME Type:", audioFile.mimetype);
        console.log("Uploaded File Size:", audioFile.size, "bytes");

        console.log("Is audio data present?", Boolean(audioFile.data && audioFile.data.length));


        const allowedFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

        const contentType = req.headers['content-type'];
        fileExtension = contentType.includes('webm') ? 'webm' : audioFile.name.split('.').pop();

        console.log("Determined File Extension:", fileExtension); // Moved after setting its value

        const allowedMimeTypes = ['audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/mpga', 'audio/m4a', 'audio/wav', 'audio/webm'];


        if (!allowedMimeTypes.includes(audioFile.mimetype)) {
            return res.status(400).send('Unsupported audio file format.');
        }

        // Prepare data for the POST request
        const formData = new FormData();
        formData.append('file', audioFile.data, {
            contentType: audioFile.mimetype,
            filename: audioFile.name
        });
        formData.append('model', 'whisper-1');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        console.log("OpenAI API Response:", response.data);

        if (response.data && response.data.text) {
            broadcastTranscription(response.data.text); 
            res.json({ transcript: response.data.text, success: true });
        } else {
            throw new Error("Unexpected response from OpenAI API");
        }

    } catch (error) {
        console.error("Error in transcription:", error.message);
        
        if (error.response && error.response.data) {
            console.error("OpenAI error response:", error.response.data);
        }

        res.status(500).send({ error: 'Failed to transcribe audio.', reason: error.message });
    }
});
    
let clients = [];

function broadcastTranscription(text) {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(text)}\n\n`); // This sends the transcription data to the client
    });
}

app.get('/transcription-updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});


app.post('/process-document', async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        let documentFile = req.files.document;
        const documentText = documentFile.data.toString('utf8');

        // Use OpenAI to extract fields (this is a basic example, and may need refinement)
        const fields = ["Name", "Birthdate", "Age", "Life expectancy", "Job", "Gender", "Injury", "Injury date", "Body part", "ICD-10 code"];
        const extractedData = {};

        for (const field of fields) {
            // This is a basic way to extract fields and may need refinement based on the document structure
            const regex = new RegExp(`${field}[:]?\\s*(.*)`, 'i');
            const match = documentText.match(regex);
            extractedData[field] = match ? match[1].trim() : "Not Found";
        }

        res.json(extractedData);

    } catch (error) {
        console.error("Error in document processing:", error.message);
        res.status(500).send({ error: 'Failed to process document.', reason: error.message });
    }
});

app.listen(5001, () => {
    console.log('Listening on port 5001');
});