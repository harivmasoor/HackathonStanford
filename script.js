// JavaScript to handle the "Generate" button click
document.getElementById('generateButton').addEventListener('click', function() {
    const selectedOption = document.querySelector('input[name="settlement"]:checked');
    if (selectedOption) {
        // Retrieve the selected value
        const selectedValue = selectedOption.value;
        console.log("Selected Lump-sum Settlement Option:", selectedValue);

        // TODO: Add any desired action here
    } else {
        alert("Please select a lump-sum settlement option before generating.");
    }
});

let isRecording = false;
let mediaRecorder;
const audioChunks = [];

// Connect to the transcription updates endpoint using Server-Sent Events
const eventSource = new EventSource('http://localhost:5001/transcription-updates');

eventSource.onmessage = function(event) {
    const transcription = JSON.parse(event.data);
    document.getElementById('typedInput').textContent = transcription;
};

async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}


const processDoc = document.getElementById('proccess-doc');
processDoc.addEventListener('click', () => {
    const pageOne = document.getElementsByClassName('page-one')[0];
    pageOne.classList.add('hidden');

    const pageTwo = document.getElementsByClassName('page-two')[0];
    pageTwo.classList.remove('hidden');
});

document.getElementById('confirm-button').addEventListener('click', () => {
    
    const pageTwo = document.getElementsByClassName('page-two')[0];
    pageTwo.classList.add('hidden');

    const pageThree = document.getElementsByClassName('page-three')[0];
    pageThree.classList.remove('hidden');
});






async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
        if (mediaRecorder.state === "inactive") {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            sendAudioToServer(audioBlob);
        }
    };
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('startStopBtn').textContent = "Stop Recording";
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('startStopBtn').textContent = "Start Recording";
}

function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    fetch('http://localhost:5001/transcribe', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.headers.get('Content-Type').includes('application/json')) {
            return response.json();
        } else {
            return response.text().then(text => {
                throw new Error(text);
            });
        }
    })
    .then(data => {
        if (data.success) {
            console.log('Transcription request sent successfully.');
        } else {
            console.error('Error:', data.reason);
            alert('Failed to transcribe audio. Please check the console for details.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to transcribe audio. Please check the console for details.');
    });
}

function processDocument() {
    const documentFileInput = document.getElementById('documentFile');
    const documentFile = documentFileInput.files[0];

    if (!documentFile) {
        alert('Please select a document first.');
        return;
    }

    const formData = new FormData();
    formData.append('document', documentFile);

    fetch('http://localhost:5001/process-document', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const tableBody = document.getElementById('documentFields');
        tableBody.innerHTML = ''; // Clear previous results

        // Sample data from sample.txt
        const sampleData = {
            "Name": "Brian Armstrong",
            "Birthdate": "2/5/1971",
            "Age": "52 years old",
            "Life expectancy": "26.16",
            "Job": "Warehouse worker",
            "Gender": "Male",
            "Injury": "Fell off a ladder while reaching for a 50lb box",
            "Injury date": "3/12/2023",
            "Body part": "Right knee",
            "ICD-10 code": "M25.561 - Right knee pain\nM17.11 - Osteoarthritis\nZ96.651 - Right artificial knee joint"
        };

        for (const field in sampleData) {
            const row = tableBody.insertRow();
            const cell1 = row.insertCell(0);
            const cell2 = row.insertCell(1);
            cell1.textContent = field;
            cell2.textContent = sampleData[field];
        }

        // Display the uploaded file
        const fileDisplay = document.getElementById('uploadedFileDisplay');
        fileDisplay.innerHTML = ''; // Clear previous display

        if (documentFile.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(documentFile);
            img.alt = 'Uploaded Image';
            img.style.maxWidth = '300px'; // Set a max width for the image
            fileDisplay.appendChild(img);
        } else if (documentFile.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = function(event) {
                const pre = document.createElement('pre');
                pre.textContent = event.target.result;
                fileDisplay.appendChild(pre);
            };
            reader.readAsText(documentFile);
        } else if (documentFile.type === 'application/pdf') {
            // Render the PDF using PDF.js
            const pdfUrl = URL.createObjectURL(documentFile);
            const canvas = document.createElement('canvas');
            fileDisplay.appendChild(canvas);

            pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
                pdf.getPage(1).then(function(page) {
                    const viewport = page.getViewport({ scale: 1.0 });
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    const renderContext = {
                        canvasContext: canvas.getContext('2d'),
                        viewport: viewport
                    };
                    page.render(renderContext);
                });
            });
        } else {
            const p = document.createElement('p');
            p.textContent = 'File uploaded: ' + documentFile.name;
            fileDisplay.appendChild(p);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to process document. Please check the console for details.');
    });
    document.querySelector('.page-two table').style.display = 'block';
    document.getElementById('uploadedFileDisplay').style.display = 'block';
    document.querySelector('.confirm-button').style.display = 'block';
}
