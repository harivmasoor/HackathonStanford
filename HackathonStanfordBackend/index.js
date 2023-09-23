
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');  // Add this line for the new functionality
const openai = require('openai');
const fileUpload = require('express-fileupload');
const FormData = require('form-data');
// const expressWs = require('express-ws'); 

if(process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.config();
}

openai.apiKey = process.env.OPENAI_API_KEY; 
const app = express();
app.use(cors());
app.use(express.json()); // Add this to parse JSON body requests
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(fileUpload());
// expressWs(app);

// app.ws('/transcription', (ws, req) => {
//     ws.on('message', (msg) => {
//         console.log('Received:', msg);
//         // Based on received message you can decide when and what to send back.
//         // For now, let's assume any message from frontend triggers sending a sample transcript.
        
//         // (You will replace the sample with the real transcript from OpenAI API when you integrate)
//         ws.send('Sample Transcription: Hello, this is a test.');
//     });

//     ws.on('close', () => {
//         console.log('WebSocket closed');
//     });
// });


// Existing CORS bypass code
app.get('/', async (req, res) => {
    if (req.query.url) {
        const proxyRes = await axios.get(req.query.url);
        res.send(proxyRes.data);
    } else {
        res.send('Please provide a url');
    }
});

// Spotify Authorization Endpoint
app.get('/login', function(req, res) {
    var state = generateRandomString(16);
    var scope = 'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-library-read playlist-read-private playlist-read-collaborative';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: 'https://podify-backend.onrender.com/callback',
            state: state
        })
    );
});
app.get('/callback', function(req, res) {
    var code = req.query.code || null;
    var state = req.query.state || null;

    if (state === null) {
        res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
    } else {
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: 'https://podify-backend.onrender.com/callback',
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
            },
            json: true
        };
        
        axios.post(authOptions.url, querystring.stringify(authOptions.form), {
            headers: authOptions.headers
        }).then(response => {
            var access_token = response.data.access_token;
            var refresh_token = response.data.refresh_token;
            res.redirect('https://harivmasoor.github.io/Podify/#' + querystring.stringify({
                access_token: access_token,
                refresh_token: refresh_token
            }));
        }).catch(error => {
            console.error("Error in token exchange:", error);
            res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
        });
    }
});
app.get('/refresh_token', function(req, res) {
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    axios.post(authOptions.url, querystring.stringify(authOptions.form), {
        headers: authOptions.headers
    }).then(response => {
        var access_token = response.data.access_token;
        res.send({ 'access_token': access_token });
    }).catch(error => {
        console.error("Error in refreshing token:", error);
        res.status(500).send({ error: 'Could not refresh access token.' });
    });
});


// Utility function for generating random string (used for the 'state' parameter)
function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
// const fs = require('fs'); //remember to remove is prod
// New endpoint to handle transcription

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




app.listen(5001, () => {
    console.log('Listening on port 5001');
});