const { BrowserWindow, Notification } = require("electron");
const path = require("node:path");


// Notify the user by sending a notification and flashing the taskbar icon
function sendNotification(app, title, body, timeout = 2000) {
  const notification = new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, "../../public/icons/icon.png"),
  });
  app.focus({ steal: true });
  notification.show();

  setTimeout(() => {
    notification.close();
  }, timeout);
}

// Set the loading state in the renderer process to show a loading spinner
function setLoading(isLoading) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send("set-loading", isLoading);
  }
}

// Helper function to send messages to the renderer process
function sendMessageToRenderer(message) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send("display-message", message);
  }
}

// Helper function to stream messages to the renderer process
function streamMessageToRenderer(message) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
      window.webContents.send("stream-message", message);
  }
}


function sendSelectedTextToRenderer(text) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send("selected-text", text);
  }
}

function focusInput() {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send("focus-input");
  }
}

// Helper function to send the selected file path to the renderer process
function sendFilePathToRenderer(filePath) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send("selected-file-path", filePath);
  }
}

module.exports = {
  sendNotification,
  setLoading,
  focusInput,
  sendMessageToRenderer,
  streamMessageToRenderer,
  sendSelectedTextToRenderer,
  sendFilePathToRenderer
};
