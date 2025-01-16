let audioContext;
let analyser;
let dataArray;
var transcript = '';
var roomNumber;
let callStartTime;
let timerInterval;
let aiHangUp = false;
let wakeLock = null;
let organisation;
let site;
var peerConnection;
var dataChannel;
var siteInstructions = "";
let microphoneStream;
let ring; // Declare the beep variable globally
let ringInterval; // Variable to hold the interval
let isOutToLunch = false;
let personaName;
let personaTitle;
let rings = 0;
let aiHasHungUp;
const maxRings = 5;
const urlParams = new URLSearchParams(window.location.search);

organisation = urlParams.get('o') || "SHORES";
site = urlParams.get('s') || "Surfers";
roomNumber = urlParams.get('r') || "";
personaName = urlParams.get('n') || "Sheila";
personaTitle = urlParams.get('t') || "The Shores Concierge";

const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/wy955rlqwqpnj39e5nib8bo0hixquwoa?site=" + site + "&organisation=" + organisation; 

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
						"Text message the location of the site to the user.",
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
						summarised_message: {
							type: "string",
							description: "summarised message of this conversation"
						}
						},
						additionalProperties: false,
						required: [
						"name",
						"phone_number",
						"summarised_message"
						]
					}
					},
					// {
					// type: "function",
					// name: "hang_up",
					// description: "Stop the conversation.",
					// parameters: {
					// 	type: "object",
					// 	properties: {},
					// 	required: []
					// }
					// },
					{
						type: "function",
						name: "fetch_room",
						description: "Update the room number into memory when the guest tells you there room number",
						parameters: {
							type: "object",
							properties: {
							room_number: {
								type: "string",
								description: "The room number that the guest is staying in"
							}
							},
							additionalProperties: false,
							required: ["room_number"]
						}
					}
			],
		},
	};
	dataChannel.send(JSON.stringify(event));
}

function initSystemInfo() {

	console.log("Initialise system information for site:" + site);

	if (site === null)
	{
		console.error("Site is not defined."); // Handle any errors
		return;
	}

	//flight mode start
	// console.log("In flight mode.");
	// setTimeout(() => {
	// 	siteInstructions = "Returned";
	// 	console.log("Site Information: " + siteInstructions);
	// }, 20000);
	// return;
	//flight mode end

	sendToWebhook({
		route: "0",  
		data1: "site_information"
	})
	.then((webhookResponse) => {
		const parsedResponse = JSON.parse(webhookResponse);
		siteInstructions = parsedResponse.organisation_instructions + "\\n\\n" + parsedResponse.site_information + "\\n\\n"
	})
	.catch((error) => {
		console.error("Error sending to webhook:", error); // Handle any errors
	});

}

window.onload = function() {
    
	if (isOutToLunch)
	{
		outToLunch()
		return;
	}

	initSystemInfo(); 
	document.getElementById('call-title').textContent = personaName;
	document.getElementById('call-subtitle').textContent = personaTitle;
	
	// Set the background image based on personaName
	document.querySelector('.responsive-background').style.backgroundImage = `${personaName}.jpeg`;
};


function outToLunch() {

	document.getElementById('call-subtitle').textContent = `Sorry, I'm out to lunch`;
	document.querySelector('.start-container').style.display = 'none'; 
	document.querySelector('.calling-container').style.display = 'none'; 
	
	
	
	
}


function initRTCConnection() {

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

		// const introMessage = {
		// 	type: "conversation.item.create",
		// 	item: {
		// 		type: "message",
		// 		role: "system",
		// 		content: [
		// 			{
		// 				type: "input_text",
		// 				text: siteInformation //`Say Hi!`//,Introduce yourself to the guest. Ask for their name and their room number. Then call the fetch_room function.`,
		// 			},
		// 		],
		// 	},
		// };

		//dataChannel.send(JSON.stringify(introMessage));

		// setTimeout(() => {
		// 	dataChannel.send(JSON.stringify({ type: "response.create" }));
		// }, 1000); 

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

		if (msg.type === 'response.function_call_arguments.done') {
			console.log(`Calling function ${msg.name} with ${msg.arguments}`);
			const args = JSON.parse(msg.arguments);

			if (msg.name === 'hang_up')
			{
				AIHangsUp();
				return;
			} else if (msg.name === 'fetch_room')
			{				
				loadRoom(args.room_number);
				return;
			}
			

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
			document.getElementById('call-title').textContent = personaName;


			
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


async function loadRoom(updatedRoom) {

	console.log("Loading room...", updatedRoom);

	if (roomNumber === updatedRoom) return;

	roomNumber = updatedRoom;

	const holdMessage = {
		type: "conversation.item.create",
		item: {
			type: "message",
			role: "system",
			content: [
				{
					type: "input_text",
					text: "Say Thanks one moment please. And wait for your next system instruction.",
				},
			],
		},
	};

	dataChannel.send(JSON.stringify(holdMessage));

	
	//dataChannel.send(JSON.stringify({ type: "response.create" }));
	dataChannel.send(
		JSON.stringify({ type: "response.create" }),
	);

	const webhookResponse = await sendToWebhook({
		route: "5",  
		data1: "fetch_room_info",
		data2: JSON.stringify({room_number: updatedRoom})
		});

	const parsedResponse = JSON.parse(webhookResponse);

	const functionResponse = {
		type: "conversation.item.create",
		item: {
			type: "message",
			role: "system",
			content: [
				{
					type: "input_text",
					text: JSON.stringify(parsedResponse.room_information),
				},
			],
		},
	};

	const instructionMessage = {
		type: "conversation.item.create",
		item: {
			type: "message",
			role: "system",
			content: [
				{
					type: "input_text",
					text: "Say I see your staying in our <insert room title>. Then ask how is your stay going and what can i doo for you?",
				},
			],
		},
	};



	dataChannel.send(JSON.stringify(functionResponse));
	dataChannel.send(JSON.stringify(instructionMessage));

	
	//dataChannel.send(JSON.stringify({ type: "response.create" }));
	dataChannel.send(
		JSON.stringify({ type: "response.create" }),
	);

	roomNumber = updatedRoom;
	console.log("Room Number Updated to:", roomNumber);

}

initRTCConnection();

function AIHangsUp() {
	if (aiHasHungUp) return

	console.log('AI Hang up.');
	
	stopCall();
	setTimeout(() => {
		
		disconnect();
		
	}, 15000);

	aiHasHungUp = true;

}

function userHangUp() {
	console.log('User Hang up.');

	
	//Can do the beep sound because it's user initiated
	ring.pause();
	ring.currentTime = 0; // Reset the beep sound to the beginning
	clearInterval(ringInterval);

	const beep = new Audio('endbeep.mp3'); 
	beep.play();

	disconnect();
	stopCall();
	

}



// Function to stop the WebRTC connection
function disconnect() {

	if (peerConnection) {
		peerConnection.close(); // Close the peer connection
		peerConnection = null;
		console.log('WebRTC connection stopped');
	}
}

function stopCall() {
	
	logCall();
	releaseWakeLock();
	stopMicrophone()
	
	timerInterval = clearInterval(timerInterval);
	document.querySelector('.start-container').style.display = 'block'; 
	document.querySelector('.calling-container').style.display = 'none'; 	
	document.getElementById('call-subtitle').textContent = personaTitle;	

}

function logCall() {
	sendToWebhook({
		route: "2", // Route 2 for sending the transcript
		data1: roomNumber,
		data2: transcript, // Send the transcript to the webhook
	});
	transcript = "";
}


async function ringUntilReady() {

	console.log("Ring until ready...");
    // Initialize the beep sound
    ring = new Audio('ring.mp4'); // Replace with your audio file path

    // Play the beep sound initially
    ring.play();

    // Return a promise that resolves when siteInformation is not null
    return new Promise((resolve) => {

        // Set an interval to check the siteInformation value
        ringInterval = setInterval(() => {
            if (siteInstructions !== "") {
                // If siteInformation is not null, stop the beep sound and clear the interval
                ring.pause();
                ring.currentTime = 0; // Reset the beep sound to the beginning
                clearInterval(ringInterval); // Clear the interval
                console.log("Site information is now available.");
                resolve(); // Resolve the promise
			}
			else if (rings >= maxRings) {
				ring.pause();
                ring.currentTime = 0; // Reset the beep sound to the beginning
                clearInterval(ringInterval);
				console.log("Rang out...")
				isOutToLunch = true;
				outToLunch();
				const beep = new Audio('endbeep.mp3'); 
				beep.play();

				resolve();
            } else {
				console.log("Site information is not available.");
                // If siteInformation is still null, keep playing the beep sound
                ring.play();
				rings += 1;
            }
        }, 2000); 
    });
}

async function startCall() {

	console.log("Start Call")

	aiHasHungUp = false;
	requestWakeLock();
	document.getElementById('call-subtitle').textContent = `Calling...`;
	document.querySelector('.start-container').style.display = 'none'; 
	document.querySelector('.calling-container').style.display = 'block'; 


	await ringUntilReady();

	if (isOutToLunch){
		return;
	}

	console.log("Ready for call!");
	//return; //flight mode

	if (peerConnection === null) {
		initRTCConnection();
	}

	

	// Capture microphone
	navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
		
		//const audioContext = new (window.AudioContext || window.webkitAudioContext)();

			// Create a media stream source from the microphone
		//const source = audioContext.createMediaStreamSource(stream);
		//ssource.connect(audioContext.destination); // Connect to speakers

		microphoneStream = stream;

	

		
		// Play a sound (for example, a beep)
		//const beep = new Audio('ring.mp3'); // Replace with your audio file path
		//beep.play();

		
		

		//setTimeout(() => {
			
			// Start the timer
			callStartTime = Date.now();
			timerInterval = setInterval(updateTimer, 1000); // Update timer every second


			//console.log('Ring finished.')
			//beep.pause(); // Pause the audio
			//beep.currentTime = 0;

			// Add microphone to PeerConnection
			stream.getTracks().forEach((track) => peerConnection.addTransceiver(track, { direction: 'sendrecv' }));

			peerConnection.createOffer().then((offer) => {
				peerConnection.setLocalDescription(offer);
				
				// Send WebRTC Offer to Workers Realtime WebRTC API Relay
				fetch('/rtc-connect', {
					method: 'POST',
					body: JSON.stringify({'offer': offer.sdp, instructions: siteInstructions}), 
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

						setTimeout(() => {
							animateCallTitle();
						}, 1500);
					});
			});
		//}, 4000);
	});
}

function updateTimer() {
	const elapsedTime = Math.floor((Date.now() - callStartTime) / 1000); // Calculate elapsed time in seconds
	const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0'); // Get minutes
	const seconds = String(elapsedTime % 60).padStart(2, '0'); // Get seconds
	document.getElementById('call-subtitle').textContent = `${minutes}:${seconds}`; // Update timer display

	//console.log(elapsedTime);

	//Stop the chat after 10 minutes
	if (elapsedTime > 600) {
		
		timerInterval = clearInterval(timerInterval);
		const endMessage = {
			type: "conversation.item.create",
			item: {
				type: "message",
				role: "system",
				content: [
					{
						type: "input_text",
						text: `The call has been going longer than expected. Explain that you have to go now and end the call. Explain they can call back if necessary.`,
					},
				],
			},
		};
	
		dataChannel.send(JSON.stringify(endMessage));
		dataChannel.send(JSON.stringify({ type: "response.create" }));

		AIHangsUp();
	}

	
}

// Add event listener to the stop button
document.querySelector('.control.stop').addEventListener('click', () => {
	userHangUp(); // Call the function to stop the WebRTC connection
});


document.querySelector('.control.start').addEventListener('click', () => {
	startCall(); // Call the function to stop the WebRTC connection
});


// Function to request wake lock
async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock is active');
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// Function to release wake lock
async function releaseWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock has been released');
    }
}

function openFullscreen() {
    const elem = document.documentElement; // Get the document element
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { // Chrome, Safari, and Opera
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
    }
}

function stopMicrophone() {
    if (microphoneStream) {
        // Stop all audio tracks
        microphoneStream.getTracks().forEach(track => {
            track.stop(); // Stop the track
        });
        microphoneStream = null; // Clear the stream reference
        console.log("Microphone access relinquished.");
    } else {
        console.log("No microphone stream to stop.");
    }
}

function animateCallTitle() {
    const callTitleElement = document.getElementById('call-title');
    
	document.getElementById('call-title').textContent = "Say Hello!";
    // Add the animation class
    callTitleElement.classList.add('flash-bulge');

    // Optionally, remove the class after the animation is done to reset
    setTimeout(() => {
        callTitleElement.classList.remove('flash-bulge');
    }, 3000); // Remove after 3 seconds
}

// Example usage




