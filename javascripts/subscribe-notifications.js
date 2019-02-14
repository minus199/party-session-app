// @ts-nocheck
{
  const mainEndpoint = "ws://localhost:3000/ws/party";

  const $eTemplate = document.querySelector("#incoming-msg-template");
  const $inputBroadcast = document.querySelector("#broadcast");
  const $subscribeButton = document.querySelector("#connect");
  const $connectedClients = document.querySelector("#connected-clients");

  const handleIncoming = function (event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      return console.error("unable to parse payload.")
    }

    //TODO: Likes counter per message. Users are only allowed to like msgs of other users.
    const $msgItem = $eTemplate.cloneNode(true);
    $msgItem.id = "";
    $msgItem.querySelector(".socket-event-client").innerText = data.client;
    $msgItem.querySelector(".socket-event-type").innerText = data.type;
    const $payload = $msgItem.querySelector(".socket-event-payload");
    for (k in data.payload) {
      $payload.classList.add("event-payload-item");
      $payload.innerHTML = `<span title="${k}">${data.payload[k]}</span>`;
    }

    setInterval(() => $msgItem.querySelector(".socket-event-timestamp").innerText = moment(data.timestamp).fromNow(), 1000);

    document.querySelector("#msgs").prepend($msgItem)
    $msgItem.classList.remove("d-none");
  }

  const sendMsgAs = function sendMsgAs(socket, e) {
    if (e.keyCode === 13) {
      socket.send(this.value);
      this.value = "";
    }

    //TODO: while typing...
  }

  function connect() {
    const socket = new WebSocket(mainEndpoint);
    const msgSender = sendMsgAs.bind($inputBroadcast, socket);

    // Connection opened
    socket.addEventListener("open", function (event) {
      $subscribeButton.classList.add("d-none");
      [$connectedClients, $inputBroadcast].forEach(e => e.classList.remove("d-none"));
      $inputBroadcast.addEventListener("keydown", msgSender);
      handleIncoming(event);
      socket.send("Can I join?");
    });


    // Listen for messages
    socket.addEventListener("message", handleIncoming);

    socket.addEventListener("error", function (event) {
      console.log("WS Error ", event);
      handleIncoming(event);
    });

    socket.addEventListener("close", function (event) {
      console.log("Closed connection ", event);
      $subscribeButton.classList.remove("d-none");
      [$connectedClients, $inputBroadcast].forEach(e => e.classList.add("d-none"));
      $inputBroadcast.removeEventListener("keydown", msgSender)
    });
  }
}