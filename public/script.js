const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/wy955rlqwqpnj39e5nib8bo0hixquwoa"; 

let audioContext;
let analyser;
let dataArray;
var transcript = '';
var location = 'Miami';
var roomNumber = '402';



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

function configureData() {
	console.log('Configuring data channel');
	const event = {
		type: 'session.update',
		session: {
			modalities: ['text', 'audio'],
			input_audio_transcription: {model: "whisper-1"},
			tools: [
				{
				
					type: "function",
					name: "contact_site_manager",
					description:
						"Send a summarised message of the conversation to the site manager of the location",
					parameters: {
						type: "object",
						properties: {
						summarised_message: {
							type: "string",
							description: "A concise summary of the conversation's content and the guest's needs. Include the room number, guest's name, and any other relevant information.",
						},
						room_number: {
							type: "string",
							description: "The room number that the guest is staying in"
						},
						guest_name: {
							type: "string",
							description: "The name of the guest staying in the room"
						},
						mobile_phone_number: {
							type: "string",
							description: "The mobile phone number of the user"
						}
						},
						additionalProperties: false,
						required: [
								"summarised_message",
								"room_number",
								"guest_name",
								"mobile_phone_number"]
						}
					},
					{
					type: "function",
					name: "send_location",
					description:
						"Text message the location of the motel shop to the user.",
					parameters: {
						type: "object",
						properties: {
						mobile_phone_number: {
							type: "string",
							description: "The mobile phone number of the user"
						}
						},
						additionalProperties: false,
						required: ["mobile_phone_number"]
					}
					},
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
					{
					type: "function",
					name: "contact_reservation_manager",
					description: "Send a summarised message of the conversation and what the caller wants to the reservation manager who can help the caller",
					parameters: {
						type: "object",
						properties: {
						name: {
							type: "string",
							description: "Name of the person to contact"
						},
						phone_number: {
							type: "string",
							description: "Phone Number of the person to contact"
						},
						email: {
							type: "string",
							description: "Email of the person to contact"
						},
						summarised_message: {
							type: "string",
							description: "summarised message of this conversation"
						}
						},
						additionalProperties: false,
						required: [
						"name",
						"phone_number",
						"email",
						"summarised_message"
						]
					}
					},
					{
					type: "function",
					name: "find_guest_in_booking_system",
					description: "Locate the guest in the booking system.",
					parameters: {
						type: "object",
						required: [
						"first_name",
						"last_name"
						],
						properties: {
						first_name: {
							"type": "string",
							"description": "The first name of the guest."
						},
						last_name: {
							"type": "string",
							"description": "The last name of the guest."
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "find_reservation",
					description: "Find the reservation in the booking system.",
					parameters: {
						type: "object",
						required: [
						"guestID"
						],
						properties: {
						guestID: {
							type: "string",
							description: "The guestID used to locate the associated reservations."
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "add_guest_credentials",
					description: "Adds the guest passport or license number to their profile",
					parameters: {
						type: "object",  
						required: [
						"guestID"
						],
						properties: {
						drivers_licence_number: {
							type: "string",
							description: "The number on their drivers licence."
						},
						passport_number: {
							type: "string",
							description: "The number listed on their passport"
						},
						guestID: {
							type: "string",
							description: "The guestID"
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "find_credit_card_on_profile",
					description: "Look up the customer in the booking system to see if they have a credit card on their profile",
					parameters: {
						type: "object",  
						required: [
						"guestID"
						],
						properties: {
						guestID: {
							type: "string",
							description: "The guestID"
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "add_credit_card_to_profile",
					description: "Adds a credit card to the guest profile",
					parameters: {
						type: "object",  
						required: [
						"guestID"
						],
						properties: {
						guestID: {
							type: "string",
							description: "The guestID"
						},
						name_on_card: {
							type: "string",
							description: "The name on the credit card "
						},
						card_number: {
							type: "string",
							description: "The credit card number"
						},
						expiry_date: {
							type: "string",
							description: "The credit card expiry date"
						},
						reservationID: {
							type: "string",
							description: "The reservationID"
						},
						depositAmount: {
							type: "string",
							description: "The deposit amount which will be held on the card."
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "start_reservation",
					description: "Start the reservation by setting the status to Checked in on the booking system.",
					parameters: {
						type: "object",  
						required: [
						"reservationID"
						],
						properties: {
						reservationID: {
							type: "string",
							description: "The reservationID"
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "get_room_details",
					description: "Get the details of the room the guest is checked into.",
					parameters: {
						type: "object",  
						required: [
						"resourceID"
						],
						properties: {
							resourceID: {
							type: "string",
							description: "The reservationID also returned as known as AssignedResourceId"
						}
						},
						additionalProperties: false
					}
					},
					{
					type: "function",
					name: "hang_up",
					description: "Stop the conversation",
					parameters: {
						type: "object",
						properties: {},
						required: []
					}
					},
			],
		},
	};
	dataChannel.send(JSON.stringify(event));
}

var peerConnection;
var dataChannel;

function initConnection() {




// Create a WebRTC Agent
peerConnection = new RTCPeerConnection();

// On inbound audio add to page
peerConnection.ontrack = (event) => {
	const el = document.createElement('audio');
	el.srcObject = event.streams[0];
	el.autoplay = el.controls = true;
	document.body.appendChild(el);
};

dataChannel = peerConnection.createDataChannel('response');


dataChannel.addEventListener('open', (ev) => {
	console.log('Opening data channel', ev);
	configureData();

	const introMessage = {
		type: "conversation.item.create",
		item: {
			type: "message",
			role: "system",
			content: [
				{
					type: "input_text",
					text: `The guest is calling from room ${roomNumber}. Introduce yourself to the guest and ask who are you speaking with and how you can help. Give them all the time they need.`,
				},
			],
		},
	};

	dataChannel.send(JSON.stringify(introMessage));
	dataChannel.send(JSON.stringify({ type: "response.create" }));

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
		if (msg.name === 'hang_up')
		{
			ai_hang_up();
			return;
		}

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

	//console.log(`msg: ${ev.data}`)

	// Log agent response
	if (msg.type === "response.done") {

		//console.log(`msg: ${ev.data}`)

		const agentMessage =
			msg.response.output[0]?.content?.find(
				(content) => content.transcript,
			)?.transcript || "Agent message not found";
		transcript += `Agent: ${agentMessage}\n`; // Add agent's message to the transcript
		console.log(`Agent: ${agentMessage}`);
		
	}

	
	//Log user transcription (input_audio_transcription.completed)
	if (
		msg.type ===
			"conversation.item.input_audio_transcription.completed" &&
		msg.transcript
	) {
		//console.log(`msg: ${ev.data}`)

		const userMessage = msg.transcript.trim(); // Get the user's transcribed message
		transcript += `User: ${userMessage}\n`; // Add the user's message to the transcript
		console.log(`User: ${userMessage}`);
	}
});

}

initConnection();

function ai_hang_up() {
	console.log('AI Hang up.');
	logCall();

	//Wait for the AI to finish it's sentence.
	setTimeout(() => {
		disconnect();
	}, 5000);

}

function user_hang_up() {
	console.log('User Hang up.');
	logCall();
	disconnect();
	//Can do the beep sound because it's user initiated
	const beep = new Audio('endbeep.mp3'); 
	beep.play();
}

// Function to stop the WebRTC connection
function disconnect() {
	console.log('Disconnect');
	//peerConnection.getTracks().forEach(track => track.stop()); // Stop all tracks
	if (peerConnection) {
		peerConnection.close(); // Close the peer connection
		peerConnection = null;
		console.log('WebRTC connection stopped');
	}
	document.querySelector('.control.start').style.display = 'block'; 
	document.querySelector('.control.stop').style.display = 'none'; 


}

function logCall() {
	sendToWebhook({
		route: "2", // Route 2 for sending the transcript
		data1: roomNumber,
		data2: transcript, // Send the transcript to the webhook
	});
	transcript = "";
}

function startCall() {

	if (peerConnection === null) {
		initConnection();
	}

	// Capture microphone
	navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
		
		//const audioContext = new (window.AudioContext || window.webkitAudioContext)();

			// Create a media stream source from the microphone
		//const source = audioContext.createMediaStreamSource(stream);
		//ssource.connect(audioContext.destination); // Connect to speakers


		document.querySelector('.control.start').style.display = 'none'; 
		document.querySelector('.control.stop').style.display = 'block'; 

		// Play a sound (for example, a beep)
		const beep = new Audio('beep.mp3'); // Replace with your audio file path
		beep.play();

		

		setTimeout(() => {
			console.log('Ring finished.')
			beep.pause(); // Pause the audio
			//beep.currentTime = 0;

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
		}, 4000);
	});
}


// Add event listener to the stop button
document.querySelector('.control.stop').addEventListener('click', () => {
	user_hang_up(); // Call the function to stop the WebRTC connection
});


document.querySelector('.control.start').addEventListener('click', () => {
	startCall(); // Call the function to stop the WebRTC connection
});


//Start the page load executionm
