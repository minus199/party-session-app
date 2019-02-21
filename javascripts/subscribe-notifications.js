//TODO: Change the user status to 'away' after 20 seconds of inactivity
{
	class SocketEvent {
		constructor(type, content) {
			this.uuid = Math.random().toString(36).split(".").pop();
			this.type = type;
			this.content = content;
			this.timestamp = Date.now();
		}

		dispatch(ws) {
			ws.send(JSON.stringify(this));
			this.isDispatched = true;
		}
	}

	SocketEvent.Events = Object.freeze({
		USER_ONLINE: "USER_ONLINE",
		USER_OFFLINE: "USER_OFFLINE",
		USER_NEW_MSG: "USER_NEW_MSG",
		RECENT_MESSAGES: "RECENT_MESSAGES",
		USER_TYPING: "USER_TYPING",
		USER_LIKED_MSG: "USER_LIKED_MSG"
	});

	const mainEndpoint = route("ws/party", "ws");

	// Select all the elements that are related to the socket feature. they are enclosed inside this closure(not visible from outside)
	const $inputBroadcast = document.querySelector("#broadcast");
	const $subscribeConnectionToggle = document.querySelector("#connect");
	const $socialElements = document.querySelectorAll(".social");
	const $onlineUserTemplate = document.querySelector("#online-user-template");
	const $onlineUsersContainer = document.querySelector("#connected-users-list");
	const $numConnectedClients = document.querySelector("#num-connected-users");
	const $incomingMsgTemplate = document.querySelector("#incoming-msg-template");
	const $chatMsgsContainer = document.querySelector("#chat-msgs");
	const $typingIndicator = document.querySelector("#typing-indicator");

	//Use jQuery to show/hide the online users list
	$($onlineUsersContainer).toggle("slide")
	$numConnectedClients.addEventListener("click", () => $($onlineUsersContainer).toggle("slide"))

	// happens when the user clicks on the blue switch on the top-right of the page to connect to the socket
	const toggleConnection = function toggleConnection(force) {
		this.checked = force === true ? true : this.checked;
		const disconnect = window.partySessionApp.subscriptions.party.disconnect;
		// if the value checked is true, it means it was false before. so the user is offline, and trying to connect
		if (this.checked && disconnect === null) {
			window.partySessionApp.subscriptions.party.disconnect = connect();
			window.partySessionApp.$els.$logoutButton.addEventListener("click", disconnect);
			return;
		}
		// the previous if made sure that if the user is connected, a disconnect hook will return from connect()
		if (typeof disconnect === "function") {
			disconnect();
			window.partySessionApp.$els.$logoutButton.removeEventListener("click", disconnect);
		}
		this.checked = false; // it is important to update the ui so the user know the connection was dropped. it will change the switch button from on to off
	}
	$subscribeConnectionToggle.addEventListener("change", toggleConnection);

	// Adds an html element for the connected user in online users list
	const newUserOnline = u => {
		const $onlineUser = $onlineUserTemplate.cloneNode(true);
		$onlineUser.querySelector(".online-username").innerText = u;
		$onlineUser.querySelector(".online-user-connection-status").classList.add("online-indicator");
		const $timestamp = $onlineUser.querySelector(".connected-at-timestamp");
		$timestamp.dataset.timestamp = Date.now(); //TODO: Get connection/disconnection time from server.

		$onlineUsersContainer.append($onlineUser);
	};

	const newIncomingUserMessage = function (socket, data) {
		//TODO: Likes counter per message. Users are only allowed to like chat-msgs of other users.
		const $msgItem = $incomingMsgTemplate.cloneNode(true);
		$msgItem.removeAttribute("id");
		$msgItem.dataset.uuid = data.uuid;

		$msgItem.querySelector(".chat-message-src-user").innerText = `${data.user === window.partySessionApp.sessionData.userName ? "You" : data.user}: `;
		$msgItem.querySelector(".chat-message-content").innerHTML = data.payload;

		const $likes = $msgItem.querySelector(".chat-message-likes-count");
		$likes.innerText = data.likedCount;

		const $timestamp = $msgItem.querySelector(".chat-message-timestamp");
		// data attributes(for example: <a data-foo="fuzz" data-bar="fozz"></a>) are useful for storing any data you find useful
		// this is how you set them. this line will add data-timestamp to the $timestamp element(see in the dom)
		$timestamp.dataset.timestamp = data.timestamp;

		$chatMsgsContainer.append($msgItem); //its important to attach the event listeners only after appending to dom.
		if (data.user !== window.partySessionApp.sessionData.userName) {
			// Disable the option for a user to like its own comment on frontend		
			$likes.addEventListener("click", function () {
				new SocketEvent(SocketEvent.Events.USER_LIKED_MSG, {
					comment_id: this.closest(".msg-item").dataset.uuid
				}).dispatch(socket);
			});
		}

		$msgItem.classList.remove("d-none");
		return $msgItem;
	};

	const TYPING_TIMER_DELAY = 350;
	let typingTimer = null;
	let activeTypingEvent = null;
	const userMsgInputHandler = function sendMsgAs(socket, e) {
		//On user hitting enter key while on message input element
		if (e.keyCode === 13) {
			//TODO: validate message content
			new SocketEvent(SocketEvent.Events.USER_NEW_MSG, this.value).dispatch(socket);
			this.value = ""; // clear the current value from the message input(same as in msgging apps)
			return;
		}

		// Each new keyboard input resets the timer and starts a new countdown.
		// Once the countdown is over, the end of the typing event will be dispatched to server
		clearTimeout(typingTimer);
		activeTypingEvent = activeTypingEvent || new SocketEvent(SocketEvent.Events.USER_TYPING, {
			inProgress: true
		});

		if (!activeTypingEvent.isDispatched) {
			// This event is across multiple user events, no need to dispatch an event to the server after each keydown
			// Dispatch when the typing starts, and dispatch again when the typing ends
			activeTypingEvent.dispatch(socket);
		}

		typingTimer = setTimeout(() => {
			// end the "is typing" after interval of inactivity
			//TODO: What if the client drops the connection before the TYPING_TIMER_DELAY is over? handle it from the server
			activeTypingEvent.content.inProgress = false;
			activeTypingEvent.dispatch(socket);
			activeTypingEvent = null;
		}, TYPING_TIMER_DELAY);
	};

	function connect() {
		const disconnect = window.partySessionApp.subscriptions.party.disconnect;
		if (disconnect !== null) {
			console.info("Tried to connect when socket is already open. Returning existing disconnect hook.")
			return disconnect;
		}

		const socket = new WebSocket(mainEndpoint);
		// Listen for messages
		socket.addEventListener("message", e => {
			//e is the socket event. amongst other things, it contains the data property which hold the raw data from the other side of the socket
			const rawIncomingEvent = JSON.parse(e.data);
			// a simple test to see if the event is from the same user that is connected to this client
			const isFromCurrentUser = rawIncomingEvent.user === window.partySessionApp.sessionData.userName;

			if (rawIncomingEvent.whosOnline) {
				// update the number of connected users
				$numConnectedClients.querySelector(".value").innerText = rawIncomingEvent.whosOnline.length;
				//Clear previous elements
				$onlineUsersContainer.innerHTML = "";
				//Create html elements for all connected users
				rawIncomingEvent.whosOnline.forEach(newUserOnline);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_ONLINE) {
				window.partySessionApp.toast(`${isFromCurrentUser ? "You" : rawIncomingEvent.user} just showed up!`);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_OFFLINE) {
				window.partySessionApp.toast(`${isFromCurrentUser ? "You": rawIncomingEvent.user} just went away!`);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_TYPING) {
				// shows the "user is typing" message at the nav bar
				$typingIndicator.querySelector(".value").innerText = rawIncomingEvent.payload.inProgress ? `${rawIncomingEvent.user} is typing...` : '';
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_NEW_MSG) {
				const $msgItem = newIncomingUserMessage(socket, rawIncomingEvent);
				window.partySessionApp.glow($msgItem, "two");
			}

			if (rawIncomingEvent.type === SocketEvent.Events.RECENT_MESSAGES) {
				//load all recent events
				$chatMsgsContainer.innerHTML = ""; // clear previous elements and recreate
				rawIncomingEvent.payload.forEach(recentEvent => newIncomingUserMessage(socket, recentEvent));
				const $lastChatMessage = document.querySelector("#chat-msgs > li:last-child")
				if ($lastChatMessage) {
					setTimeout(_ => window.partySessionApp.glow($lastChatMessage, "two"), 50); // scroll to the most recent comment
				}
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_LIKED_MSG) {
				// TODO: Server should enfore "liking" policy, but should also be checked in the UI
				// User is only allowed to like messages of other users
				//TODO: The user who liked the comment doesn't need to see the comment container blink
				const $likedComment = $chatMsgsContainer.querySelector(`[data-uuid='${rawIncomingEvent.payload.comment_id}']`);
				// We can select just the number of likes container
				// const $likedCommentLikesContainer = $msgsContainer.querySelector(`[data-uuid='${data.payload.comment_id}'] .chat-message-likes-count`);
				// Or select if from the liked comment
				// const $likedCommentLikesContainer = $likedComment.querySelector(".chat-message-likes-count")
				if (!$likedComment) return; // nothing to do
				$likedComment.querySelector(".chat-message-likes-count").innerText = rawIncomingEvent.likedCount;
				window.partySessionApp.toast(`${rawIncomingEvent.user} likes your comment.`);
				window.partySessionApp.glow($likedComment);
				//TODO: Server should know the amount of likes on each comment
				//TODO: Let the user know someone liked the comment(`Hey, ${currentUser.username}! ${data.payload.from_user} liked your message!`)
				// $likedCommentLikesContainer.innerText = numOfLikesFromServer;
			}
		});

		// this is a convinience. Instead of passing the socket everytime, we simply bind the element as the context and the socket as the first argument.
		const socketBoundUserMsgInputHandler = userMsgInputHandler.bind($inputBroadcast, socket);

		socket.addEventListener("open", function () {
			// all the elements related to the socket features are invisible. show them on connection open
			$socialElements.forEach(el => el.classList.remove("d-none"));
			// add the event listener for the chat text input 
			$inputBroadcast.addEventListener("keydown", socketBoundUserMsgInputHandler);
			$inputBroadcast.focus(); // focus on the chat message input so the user can start typing right away
		});

		const socketShutdown = function (e) {
			$socialElements.forEach(el => el.classList.add("d-none"));
			$inputBroadcast.removeEventListener("keydown", socketBoundUserMsgInputHandler);
			$subscribeConnectionToggle.checked = false;
			window.partySessionApp.toast("Connection lost :-(");
			window.partySessionApp.subscriptions.party.disconnect = null;
		}

		socket.addEventListener("close", socketShutdown);
		socket.addEventListener("error", socketShutdown);

		return window.partySessionApp.subscriptions.party.disconnect = () => {
			socket.close();
			window.partySessionApp.subscriptions.party.disconnect = null;
		}
	}

	toggleConnection.call($subscribeConnectionToggle, true);
}