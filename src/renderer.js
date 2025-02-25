// Listen for messages from the main process
window.electronAPI.onDisplayMessage((message) => {
  displayMessage(message);
});

// Listen for focus input event from the main process
window.electronAPI.onFocusInput(() => {
  const userInput = document.getElementById("user-input");
  userInput.focus();
});


// Listen for stream messages from the main process
window.electronAPI.onStreamMessage((message) => {
  const messageItem = document.querySelector(".message-item:last-child");
    if (message !== undefined) {
      messageItem.textContent += message;
      messageItem.scrollIntoView({ behavior: "smooth", block: "end" });
    }
});

// add the filepath to the input field
window.electronAPI.onSelectedFilePath((filePath) => {
  insertSpecialElement("F", filePath);
});

// Function to display messages in the message container
function displayMessage(message, isUser = false) {
  const messageItem = document.createElement("div");
  const messageContainer = document.getElementById("message-container");
  messageItem.className = "message-item";
  messageItem.classList.add(isUser ? "user-message" : "llm-message");
  messageItem.textContent = message;

  messageContainer.appendChild(messageItem);
  messageItem.scrollIntoView({ behavior: "smooth", block: "end" });
  return messageItem;
}

// Event listener for the "Send" button click event
document.getElementById("send-btn").addEventListener("click", async () => {
  const userInput = document.getElementById("user-input");
  const userInputText = userInput.value;
  userInput.value = "";
  userInput.focus();
  document.getElementById("user-input").value = "";

  if (userInputText.trim() !== "") {
    displayMessage(userInputText, true);
    displayMessage("", false);
    await window.electronAPI.respond(userInputText);
  }
});

// Event listener for the "Enter" key on the input element
document.getElementById("user-input").addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    document.getElementById("send-btn").click();
  }
});

// handle slash commands in the input field
document.getElementById("user-input").addEventListener("input", async (event) => {
  const userInput = event.target;
  if (userInput.value.includes("/c")) {

    userInput.value = userInput.value.replace("/c", "");
    const clipText = await window.electronAPI.getClipboardText();
    insertSpecialElement("C", clipText);

  } else if (userInput.value.includes("/f")) {

    userInput.value = userInput.value.replace("/f", "");
    openFilePicker();

  } else if (userInput.value.includes("/n")) {

    userInput.value = userInput.value.replace("/n", "");
    await window.electronAPI.clearHistory();
    const messageContainer = document.getElementById("message-container");
    messageContainer.innerHTML = "";

  }
});

// Adding special elements to the input field for clipboard and file
function insertSpecialElement(text, hoverText) {
  const specialElements = document.querySelectorAll(".special-element");
  specialElements.forEach((specialElement) => {
    specialElement.remove();
  });
  const userInput = document.getElementById("user-input");
  const specialElement = document.createElement("span");
  specialElement.className = "special-element";
  specialElement.textContent = text;
  specialElement.addEventListener("mouseover", () => {
    showHoverText(hoverText, text);
    specialElement.style.outline = "2px solid red";
  });
  specialElement.addEventListener("mouseout", () => {
    hideHoverText();
    specialElement.style.outline = "none";
  });
  specialElement.addEventListener("click", () => {
    specialElement.remove();
  });
  userInput.parentNode.insertBefore(specialElement, userInput.nextSibling);
}

// Function to show hover text
function showHoverText(text) {
  hideHoverText();
  const hoverText = document.createElement("div");
  hoverText.className = "hover-text";
  hoverText.textContent = text;
  document.body.appendChild(hoverText);
}

// Function to hide hover text
function hideHoverText() {
  const hoverTexts = document.querySelectorAll(".hover-text");
  hoverTexts.forEach((hoverText) => {
    hoverText.classList.remove("show");
    setTimeout(() => {
      hoverText.remove();
    }, 300);
  });
}

// Function to open file picker
function openFilePicker() {
  window.electronAPI.openFilePicker();
}
