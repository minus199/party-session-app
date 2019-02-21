const SERVER_URL = "//localhost:3000";
const route = (path, protocol = "http") => `${protocol}:${SERVER_URL}/${path}`;
setInterval(() => {
    /*
    	we want to be able to update all the timestamp elements in the ui('few seconds ago' etc)
    	so instead of handling each by its own, we will update all currently existing at once
    	in order to do so, we need to know about all the timestamps elements.
    	if the element has been added to the dom at some point later in the future, we will need to query for it again
    	this is why we first query only the elements that can contain elements which needs to be updated, instead of searching the entire dom
    */
    document.querySelectorAll(".contains-timestamps [data-timestamp]").forEach($el => {
        $el.innerText = moment(parseInt($el.dataset.timestamp)).fromNow();
    });
}, 10 * 1000);

{
    let sessionData = null;
    window.partySessionApp = {
        get sessionData() {
            if (sessionData === null) {
                sessionData = JSON.parse(localStorage.getItem("session_data"))
            }
            return sessionData;
        },
        $els: {
            $logoutButton: document.querySelector("#logout"),
            timestamps: []
        },
        subscriptions: {
            party: {
                disconnect: null
            }
        },
        scrollToBottom() {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            })
        },
        glow($el, style = "one", scrollToEl = true, delay = 3000) {
            const currentStyleClass = `glow-${style}`;
            $el.classList.add(currentStyleClass); // this will make the element glow
            if (scrollToEl) {
                window.scroll({ // will scroll to the liked comment
                    top: $el.getBoundingClientRect().top + window.scrollY - 130,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => $el.classList.remove(currentStyleClass), delay); // stop glowing after 3 secs
        },
        toast: function () {
            const $toastTemplate = document.querySelector("#chat-notifications-toast-template");
            const $chatToastsContainer = $(document.querySelector("#chat-toasts"));
            return infoMsg => {
                const $currentToast = $toastTemplate.cloneNode(true)
                $currentToast.removeAttribute("id");
                $(".chat-notification-content", $($currentToast)).text(infoMsg)
                $($currentToast).appendTo($chatToastsContainer)
                    .toast('show')
                    .on('hidden.bs.toast', () => $currentToast.remove());
            }
        }()
    };
}