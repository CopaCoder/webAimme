const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/wy955rlqwqpnj39e5nib8bo0hixquwoa"; 

let audioContext;
let analyser;
let dataArray;

// Function to initialize WebRTC and audio processing
async function initWebRTC() {
    const peerConnection = new RTCPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    // Create an audio context and analyser
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Start monitoring voice activity
    monitorVoiceActivity();
}

// Function to monitor voice activity
function monitorVoiceActivity() {
    const voiceIndicator = document.getElementById('voiceIndicator');

    function checkVoiceActivity() {
        analyser.getByteFrequencyData(dataArray); // Get frequency data

        // Calculate the average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

        // Update the voice indicator based on the average volume
        if (average > 50) { // Adjust threshold as needed
            voiceIndicator.style.backgroundColor = 'green'; // Active
        } else {
            voiceIndicator.style.backgroundColor = 'gray'; // Inactive
        }

        requestAnimationFrame(checkVoiceActivity); // Continue checking
    }

    checkVoiceActivity(); // Start the loop
}

// Call initWebRTC when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    initWebRTC(); // Initialize WebRTC and audio processing
});

async function sendToWebhook(payload) {
    console.log("Sending data to webhook:", JSON.stringify(payload, null, 2)); // Log the data being sent
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json", // Set content type as JSON
            },
            body: JSON.stringify(payload), // Send the payload as a JSON string
        });

        console.log("Webhook response status:", response.status);
        if (response.ok) {
            const responseText = await response.text(); // Get the text response from the webhook
            console.log("Webhook response:", responseText);
            return responseText; // Return the response
        } else {
            console.error(
                "Failed to send data to webhook:",
                response.statusText,
            );
            throw new Error("Webhook request failed"); // Throw an error if the request fails
        }
    } catch (error) {
        console.error("Error sending data to webhook:", error); // Log any errors in the request
        throw error;
    }
}


// Create a WebRTC Agent
const peerConnection = new RTCPeerConnection();

// On inbound audio add to page
peerConnection.ontrack = (event) => {
	const el = document.createElement('audio');
	el.srcObject = event.streams[0];
	el.autoplay = el.controls = true;
	document.body.appendChild(el);
};

const dataChannel = peerConnection.createDataChannel('response');

function configureData() {
	console.log('Configuring data channel');
	const event = {
		type: 'session.update',
		session: {
			modalities: ['text', 'audio'],
			tools: [
				{
					type: "function",
					name: "find_something",
					description: "Help the guest find something in the hotel room",
					parameters: {
					  type: "object",
					  properties: {
						object: {
						  type: "string",
						  description: "What the guest is looking for, e.g. hairdryer, coffee machine, blanket"
						},
						room_number: {
						  type: "string",
						  description: "The room number that the guest is staying in"
						}
					  },
					  additionalProperties: false,
					  required: ["object", "room_number"]
					}
				},
			],
		},
	};
	dataChannel.send(JSON.stringify(event));
}

dataChannel.addEventListener('open', (ev) => {
	console.log('Opening data channel', ev);
	configureData();
});

// {
//     "type": "response.function_call_arguments.done",
//     "event_id": "event_Ad2gt864G595umbCs2aF9",
//     "response_id": "resp_Ad2griUWUjsyeLyAVtTtt",
//     "item_id": "item_Ad2gsxA84w9GgEvFwW1Ex",
//     "output_index": 1,
//     "call_id": "call_PG12S5ER7l7HrvZz",
//     "name": "get_weather",
//     "arguments": "{\"location\":\"Portland, Oregon\"}"
// }

dataChannel.addEventListener('message', async (ev) => {
	const msg = JSON.parse(ev.data);
	// Handle function calls
	if (msg.type === 'response.function_call_arguments.done') {
		console.log(`Calling function ${msg.name} with ${msg.arguments}`);
		const args = JSON.parse(msg.arguments);

		const webhookResponse = await sendToWebhook({
			route: "5",  
			data1: msg.name,
			data2: JSON.stringify(args),
			sessionID: 'sessionId'
			});

		console.log(webhookResponse);
		// Parse the webhook response
		const parsedResponse = JSON.parse(webhookResponse);

		

		const functionReturn = {
			type: "conversation.item.create",
			item: {
				call_id: msg.call_id,
				type: "function_call_output",
				role: "system",
				output: JSON.stringify(parsedResponse.values),  
			}
		};

		const messageResponse = {
			type: "conversation.item.create",
			item: {
				type: "message",
				role: "user",
				content: [
					{
						type: "input_text",
						text: JSON.stringify(parsedResponse.instructions),
					},
				],
			},
		};

		console.log("functionReturn")
		console.log(JSON.stringify(functionReturn))

		console.log("messageResponse")
		console.log(JSON.stringify(messageResponse))

		
		dataChannel.send(JSON.stringify(functionReturn));
		dataChannel.send(JSON.stringify(messageResponse));

		dataChannel.send(
			JSON.stringify({ type: "response.create" }),
		);
	}
});

// Capture microphone
navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
	// Add microphone to PeerConnection
	stream.getTracks().forEach((track) => peerConnection.addTransceiver(track, { direction: 'sendrecv' }));

	peerConnection.createOffer().then((offer) => {
		peerConnection.setLocalDescription(offer);

		// Send WebRTC Offer to Workers Realtime WebRTC API Relay
		fetch('/rtc-connect', {
			method: 'POST',
			body: offer.sdp,
			headers: {
				'Content-Type': 'application/sdp',
			},
		})
			.then((r) => r.text())
			.then((answer) => {
				// Accept answer from Realtime WebRTC API
				peerConnection.setRemoteDescription({
					sdp: answer,
					type: 'answer',
				});
			});
	});
});
