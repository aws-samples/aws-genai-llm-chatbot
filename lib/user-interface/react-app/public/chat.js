const style = document.createElement('style')
document.head.appendChild(style)
style.sheet.insertRule(` #KAIChatButton {
  align-items: center;
  background: #f9c623;
  bottom: 0;
  color: #000000;
  display: flex;
  font-family: "Open Sans", sans-serif;
  font-weight: 700;
  height: 36px;
  justify-content: center;
  padding: 0;
  position: fixed;
  right: 10px;
  width: 500px;
  z-index: 2147483640;
}`, style.sheet.cssRules.length)
style.sheet.insertRule(` #KAIChatButton.close {
  bottom: 600px;
  right: 10px;
  top: auto;
  width: 100px;
}`, style.sheet.cssRules.length)
style.sheet.insertRule(` #KAIChatButton:active { color: #9a7d17; }`, style.sheet.cssRules.length)
style.sheet.insertRule(` #KAIChatButton:focus { color: #9a7d17; }`, style.sheet.cssRules.length)
style.sheet.insertRule(` #KAIChatButton:hover { color: #9a7d17; }`, style.sheet.cssRules.length)


const iframe = document.createElement('iframe')
iframe.setAttribute('title', 'Chat Window')
iframe.setAttribute('src', 'https://d2ins6zcpv691t.cloudfront.net/embedded')
// iframe.setAttribute('src', 'http://localhost:3000/embedded')
iframe.setAttribute('allow', 'fullscreen')
iframe.setAttribute('name', 'chat')
iframe.setAttribute('style', `
  background: white;
  border: none;
  border-radius: 10px;
  bottom: 0;
  display: none;
  height: 600px;
  position: fixed;
  right: 10px;
  width: 500px;
  z-index: 10000;
`)
document.body.appendChild(iframe)

const chatButton = document.createElement('button')
chatButton.setAttribute('id', 'KAIChatButton')
chatButton.innerHTML = 'Chat'
chatButton.addEventListener("click", () => {
  if (iframe.style.display === "none") {
    iframe.style.display = "block"
    iframe.focus()
    chatButton.classList.add('close')
    chatButton.innerHTML = "Close"
  } else {
    iframe.style.display = "none"
    chatButton.classList.remove('close')
    chatButton.innerHTML = "Chat"
  }
})
document.body.appendChild(chatButton)
document.getElementById('chat-widget-container').style.display = 'none'
