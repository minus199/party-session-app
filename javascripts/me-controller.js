{
  const uname = document.querySelector("#login-username");
  const pword = document.querySelector("#login-password");

  document.querySelector("#do-login").addEventListener("click", login);

  function login() {
    const auth = `Basic ${btoa(`${uname.value}:${pword.value}`)}`;
    uname.value = "";
    pword.value = "";
    return fetch("http://localhost:3000/login", {
      method: "POST",
      headers: new Headers({
        Authorization: auth
      })
    }).then(setContent);
  }
}

{
  const $loginForm = document.querySelector("#login-form");
  const $menu = document.querySelector("#menu");
  function setContent() {
    getSessionData().then(sessData => {

      if (sessData.isLoggedIn) {
        document.querySelector("#connected-user").innerText = `Hello, ${sessData.userName}`
        $loginForm.classList.add("d-none");
        $menu.classList.remove("d-none");
      } else {
        $loginForm.classList.remove("d-none");
        $menu.classList.add("d-none");
      }
    });
  }
}

function getProfile() {
  return fetch("http://localhost:3000/me/profile").then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  });
}

function getSessionData() {
  return fetch("http://localhost:3000/login-status").then(response => response.json())
}
setContent();
