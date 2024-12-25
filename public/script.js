const hand = new Hand();
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/wy955rlqwqpnj39e5nib8bo0hixquwoa"; 

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

function talkToTheHand() {
	hand
		.connect()
		.then(() => console.log('Hand is ready'))
		.catch((err) => console.error(err));
}

const fns = {
	getPageHTML: () => {
		return { success: true, html: document.documentElement.outerHTML };
	},
	changeBackgroundColor: ({ color }) => {
		document.body.style.backgroundColor = color;
		return { success: true, color };
	},
	changeTextColor: ({ color }) => {
		document.body.style.color = color;
		return { success: true, color };
	},
	showFingers: async ({ numberOfFingers }) => {
		await hand.sendCommand(numberOfFingers);
		return { success: true, numberOfFingers };
	},
	find_something: async ({ object, room_number }) => {
		console.log('Looking for something...');
       
        const webhookResponse = await sendToWebhook({
          route: "5",  
          data1: 'find_something',
          data2: JSON.stringify({object:object, room_number:room_number}),
          sessionID: 'sessionId'
        });

        // Parse the webhook response
        //const parsedResponse = JSON.parse(webhookResponse);

        return webhookResponse;
	},
};

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
			// Provide the tools. Note they match the keys in the `fns` object above
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
				{
					type: 'function',
					name: 'changeBackgroundColor',
					description: 'Changes the background color of a web page',
					parameters: {
						type: 'object',
						properties: {
							color: { type: 'string', description: 'A hex value of the color' },
						},
					},
				},
				{
					type: 'function',
					name: 'changeTextColor',
					description: 'Changes the text color of a web page',
					parameters: {
						type: 'object',
						properties: {
							color: { type: 'string', description: 'A hex value of the color' },
						},
					},
				},
				{
					type: 'function',
					name: 'showFingers',
					description: 'Controls a robot hand to show a specific number of fingers',
					parameters: {
						type: 'object',
						properties: {
							numberOfFingers: { type: 'string', description: 'Values 1 through 5 of the number of fingers to hold up' },
						},
					},
				},
				{
					type: 'function',
					name: 'getPageHTML',
					description: 'Gets the HTML for the current page',
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
		const fn = fns[msg.name];
		if (fn !== undefined) {
			console.log(`Calling local function ${msg.name} with ${msg.arguments}`);
			const args = JSON.parse(msg.arguments);
			const webhookResponse = await fn(args);

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
