//TODO: Change the user status to 'away' after 20 seconds of inactivity
{
	class SocketEvent {
		constructor(username, type, content) {
			this.uuid = Math.random().toString(36).split(".").pop();
			this.user = username;
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

	const sessionData = JSON.parse(localStorage.getItem("session_data"));
	const mainEndpoint = route("ws/party", "ws");

	const $inputBroadcast = document.querySelector("#broadcast");
	const $subscribeToggle = document.querySelector("#connect");

	const $onlineUserTemplate = document.querySelector("#online-user-template");
	const $onlineUsersContainer = document.querySelector("#connected-users-list");
	const $numConnectedClients = document.querySelector("#num-connected-users");
	$($onlineUsersContainer).toggle("slide")
	$numConnectedClients.addEventListener("click", () => $($onlineUsersContainer).toggle("slide"))

	const $eTemplate = document.querySelector("#incoming-msg-template");
	const $chatMsgsContainer = document.querySelector("#msgs");
	const $typingIndicator = document.querySelector("#typing-indicator");

	const $toastTemplate = document.querySelector("#chat-notifications-toast-template");
	const $chatToastsContainer = $(document.querySelector("#chat-toasts"));
	const newToast = infoMsg => {
		const $currentToast = $toastTemplate.cloneNode(true)
		$currentToast.classList.remove("d-none");
		$currentToast.removeAttribute("id");
		$(".chat-notification-content", $($currentToast)).text(infoMsg)
		$($currentToast).appendTo($chatToastsContainer)
			.toast('show')
			.on('hidden.bs.toast', () => $currentToast.remove());
	}

	const $logoutButton = document.querySelector("#logout");

	let disconnect = null;
	$subscribeToggle.addEventListener("change", function toggleConnection() {
		if (this.checked && disconnect === null) {
			disconnect = connect();
			$logoutButton.addEventListener("click", disconnect);
			return;
		}

		if (typeof disconnect === "function") {
			disconnect();
			$logoutButton.removeEventListener("click", disconnect);
		}
	});

	/* since we clear the container each time, we need to cancel all existing timers */
	const updateTimeStampOnlineUsersTimers = [];
	const newUserOnline = u => {
		const $onlineUser = $onlineUserTemplate.cloneNode(true);
		$onlineUser.classList.remove("d-none");
		$onlineUser.querySelector(".online-username").innerText = u;
		$onlineUser.querySelector(".online-user-connection-status").classList.add("online-indicator");
		const $timestamp = $onlineUser.querySelector(".connected-at-time");
		$timestamp.innerText = `Just now!`;
		const connectedAt = Date.now(); //TODO: Get connection/disconnection time from server.
		const timer = setInterval(() => ($timestamp.innerText = moment(connectedAt).fromNow()), 10000);
		updateTimeStampOnlineUsersTimers.push(timer);
		$onlineUsersContainer.append($onlineUser);
	};

	const newIncomingUserMessage = function (socket, data) {
		//TODO: Likes counter per message. Users are only allowed to like msgs of other users.
		const $msgItem = $eTemplate.cloneNode(true);
		$msgItem.removeAttribute("id");
		$msgItem.dataset.uuid = data.uuid;
		$msgItem.querySelector(".chat-message-src-user").innerText = `${data.client === sessionData.userName ? "You" : data.client}: `;
		$msgItem.querySelector(".chat-message-content").innerHTML = data.payload;
		const $likes = $msgItem.querySelector(".chat-message-likes-count");
		$likes.innerText = data.likedCount;

		const $timestamp = $msgItem.querySelector(".chat-message-timestamp");
		$timestamp.innerText = moment(data.timestamp).fromNow();
		setInterval(() => ($timestamp.innerText = moment(data.timestamp).fromNow()), 10000);

		$chatMsgsContainer.prepend($msgItem); //its important to attach the event listeners only after appending to dom.
		if (data.client !== sessionData.userName) {
			// Disable the option for a user to like its own comment on frontend		
			$likes.addEventListener("click", function () {
				new SocketEvent(sessionData.userName, SocketEvent.Events.USER_LIKED_MSG, {
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
			new SocketEvent(sessionData.userName, SocketEvent.Events.USER_NEW_MSG, this.value).dispatch(socket);
			this.value = ""; // clear the current value from the message input(same as in msgging apps)
			return;
		}

		// Each new keyboard input resets the timer and starts a new countdown.
		// Once the countdown is over, the end of the typing event will be dispatched to server
		clearTimeout(typingTimer);
		activeTypingEvent = activeTypingEvent || new SocketEvent(sessionData.userName, SocketEvent.Events.USER_TYPING, {
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
		if (disconnect !== null){
			console.info("Tried to connect when socket is already open. Returning existing disconnect hook.")
			return disconnect;
		}

		const socket = new WebSocket(mainEndpoint);
		// Listen for messages
		socket.addEventListener("message", e => {
			const rawIncomingEvent = JSON.parse(e.data);

			if (rawIncomingEvent.whosOnline) {
				$numConnectedClients.querySelector(".value").innerText = rawIncomingEvent.whosOnline.length;

				//Clear previous timers and elements
				$onlineUsersContainer.innerHTML = "";
				updateTimeStampOnlineUsersTimers.forEach(clearTimeout);
				//Create html elements for all connected users
				rawIncomingEvent.whosOnline.forEach(newUserOnline);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_ONLINE) {
				newToast(`${rawIncomingEvent.user} showed up!`);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_OFFLINE) {
				newToast(`${rawIncomingEvent.user} went away!`);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_TYPING) {
				// shows the "user is typing" message at the nav bar
				$typingIndicator.querySelector(".value").innerText = rawIncomingEvent.payload.inProgress ? `${rawIncomingEvent.client} is typing...` : '';
				$typingIndicator.classList.toggle("d-none", !rawIncomingEvent.payload.inProgress);
			}

			if (rawIncomingEvent.type === SocketEvent.Events.USER_NEW_MSG) {
				const $msgItem = newIncomingUserMessage(socket, rawIncomingEvent);
				// this will scroll to top when a new msg comes in
				window.scroll({
					top: $msgItem.getBoundingClientRect().top + window.scrollY - 10,
					behavior: 'smooth'
				});
				$msgItem.classList.add("glow-two");
				setTimeout(() => $msgItem.classList.remove("glow-two"), 3000)
			}

			if (rawIncomingEvent.type === SocketEvent.Events.RECENT_MESSAGES) {
				//load all recent events
				$chatMsgsContainer.innerHTML = ""; // clear previous elements and recreate
				rawIncomingEvent.payload.forEach(recentEvent => newIncomingUserMessage(socket, recentEvent))
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
				newToast(`You now have ${rawIncomingEvent.likedCount} likes on your comment.`);
				$likedComment.classList.add("glow-one"); // this will make the liked comment glow
				window.scroll({ // will scroll to the liked comment
					top: $likedComment.getBoundingClientRect().top + window.scrollY - 200,
					behavior: 'smooth'
				});
				setTimeout(() => $likedComment.classList.remove("glow-one"), 3000); // stop glowing after 3 secs
				//TODO: Server should know the amount of likes on each comment
				//TODO: Let the user know someone liked the comment(`Hey, ${currentUser.username}! ${data.payload.from_user} liked your message!`)
				// $likedCommentLikesContainer.innerText = numOfLikesFromServer;
			}
		});

		const socketBoundUserMsgInputHandler = userMsgInputHandler.bind($inputBroadcast, socket);

		socket.addEventListener("open", function () {
			document.querySelectorAll(".social").forEach(el => el.classList.remove("d-none"));
			$inputBroadcast.addEventListener("keydown", socketBoundUserMsgInputHandler);
			$inputBroadcast.focus();
		});

		const socketShutdown = function (e) {
			document.querySelectorAll(".social").forEach(el => el.classList.add("d-none"));
			$inputBroadcast.removeEventListener("keydown", socketBoundUserMsgInputHandler);
			$subscribeToggle.checked = false;
			newToast("Connection lost :-(");
		}

		socket.addEventListener("close", socketShutdown);
		socket.addEventListener("error", socketShutdown);

		return disconnect = () => {
			socket.close();
			disconnect = null;
		}
	}
}