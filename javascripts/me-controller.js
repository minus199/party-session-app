{
  const uname = document.querySelector("#login-username");
  const pword = document.querySelector("#login-password");

  document.querySelector("#do-login").addEventListener("click", login);
  document.querySelector("#logout").addEventListener("click", logout);

  function login() {
    const auth = `Basic ${btoa(`${uname.value}:${pword.value}`)}`;
    uname.value = "";
    pword.value = "";
    return fetch(route("login"), {
      method: "POST",
      headers: new Headers({
        Authorization: auth,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      })
    }).then(setContent);
  }
}

function logout() {
  fetch(route("logout"), {
    method: "POST"
  }).then(() => location.reload()); // we dont want to leave sensitive data(like messages and any activity of logdedin user) in the dom after logout
}

{
  const $loginForm = document.querySelector("#login-form");
  const $menu = document.querySelector("#menu");

  function setContent() {
    getSessionData().then(sessData => {
      if (sessData.isLoggedIn) {
        document.querySelector("#online-user").innerText = `Hello, ${sessData.userName}`
        $loginForm.classList.add("d-none");
        $menu.classList.remove("d-none");
        localStorage.setItem("session_data", JSON.stringify(sessData));
      } else {
        $loginForm.classList.remove("d-none");
        $menu.classList.add("d-none");
      }
    });
  }
}

function getProfile() {
  return fetch(route("me/profile")).then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  });
}

function getSessionData() {
  return fetch(route("login-status")).then(response => response.json())
}

setContent();