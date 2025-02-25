const fs = require("fs");
const path = require("node:path");
const pdf2md = require("@opendocsg/pdf2md");
const { LMStudioClient } = require("@lmstudio/sdk");
const {
  sendNotification,
  setLoading,
  streamMessageToRenderer,
  sendFilePathToRenderer,
  focusInput,
} = require("./utils");
const {
  app,
  ipcMain,
  BrowserWindow,
  globalShortcut,
  clipboard,
  Tray,
  Menu,
  dialog,
} = require("electron");

// Load configuration

const configPath = path.join(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const modelPath = config.modelPath;

const functions = JSON.parse(fs.readFileSync(path.join(__dirname, "./functions.json"), "utf-8"));

// ----------------------------------------------------------------------------
// LMStudioClient
// ----------------------------------------------------------------------------

const client = new LMStudioClient();

// Look for the model, if not found, load it
async function loadModel() {
  model = await client.llm.get({ identifier: "my-model" }).catch(async () => {
    return await client.llm.load(modelPath, {
      config: {
        gpuOffload: {
          ratio: 1.0,
          mainGpu: 0,
          tensorSplit: [1.0],
          splitStrategy: "favorMainGpu",
        },
      },
      identifier: "my-model",
    });
  });
  return model;
}

// ----------------------------------------------------------------------------
// Application window creation and management
// ----------------------------------------------------------------------------

let tray = null;

let mainWindow;

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, "./preload.js"),
    },
    transparent: true,
    resizable: false,
    movable: true,
    frame: false,
    fullscreen: false,
    icon: path.join(__dirname, "../public/icons/icon.ico"),
    skipTaskbar: true,
    alwaysOnTop: true,
  });
  mainWindow.center();
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));

  mainWindow.on("hide", (event) => {
    event.preventDefault();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "../public/icons/icon.ico"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Restore",
      click: () => {
        mainWindow.show();
        tray.destroy();
      },
    },
    {
      label: "Open Developer Tools",
      click: () => mainWindow.webContents.openDevTools(),
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip("My Application");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow.show();
  });
}

// ----------------------------------------------------------------------------
// Text processing functions
// ----------------------------------------------------------------------------

// Read file and convert to text (supports PDF and text files)
async function readFile(filePath) {
  const pdfBuffer = fs.readFileSync(filePath);
  const extname = path.extname(filePath).toLowerCase();
  let text;
  if (extname === ".pdf") {
    text = await pdf2md(pdfBuffer);
  } else {
    text = fs.readFileSync(filePath, "utf-8");
  }
  return text;
}

const historyPath = path.join(__dirname, "./history.json");

// Load history from file
function loadHistory() {
  if (fs.existsSync(historyPath)) {
    const historyData = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(historyData);
  }
  return [];
}

// Save history to file
function saveHistory(history) {
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

// Initialize history
let history = loadHistory();

let file = "";
let clipText = "";

// Respond to the text using the LLM model
async function respond(userInputText) {
  setLoading(true);
  let model;
  model = await loadModel();

  // Check if userInputText matches any function
  const matchedFunction = functions.find((func) => userInputText.toLowerCase().includes(func.function));
  if (matchedFunction) {
    userInputText = `You must respond like this: ${matchedFunction.example[0].output}\n${matchedFunction.prompt}\n`;
  }

  if (file !== "") {
    let fileContents = await readFile(file);
    userInputText = `\n${fileContents}\n${userInputText}`;
  }

  if (clipText !== "") {
    userInputText = `\n${clipText}\n${userInputText}`;
  }

  history.push({ role: "user", content: userInputText });

  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant who gives the briefest responses. You never use markdown and give direct results with no fillers.",
    },
    ...history,
  ];

  const prediction = model.respond(messages);

  let responseContent = "";
  for await (const { content } of prediction) {
    setLoading(false);
    process.stdout.write(content);
    if (content !== undefined) {
      streamMessageToRenderer(content);
      responseContent += content;
    }
  }
  history.push({ role: "assistant", content: responseContent });
  saveHistory(history);
  console.log(messages);
  return responseContent;
}

// ----------------------------------------------------------------------------
// IPC Handlers
// ----------------------------------------------------------------------------

ipcMain.on("minimize-window", (event) => {
  mainWindow.hide();
});

ipcMain.handle("respond", async (event, userInputText) => {
  await respond(userInputText);
});

// Handle clipboard text request
ipcMain.handle("get-clipboard-text", async () => {
  let text = await clipboard.readText();
  clipText = text;
  file = "";
  return text;
});

// Handle file picker request
ipcMain.handle("open-file-picker", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    console.log("Selected file:", filePath);
    sendFilePathToRenderer(filePath);
    file = filePath;
    clipText = "";
  }
});

// Clear history by deleting the history JSON file
ipcMain.handle("clear-history", async () => {
  if (fs.existsSync(historyPath)) {
    fs.unlinkSync(historyPath);
  }
  history = [];
});

// ----------------------------------------------------------------------------
// App lifecycle events
// ----------------------------------------------------------------------------

// Unregister all shortcuts before quitting
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Initialize the application and create the main window when Electron is ready
app.whenReady().then(() => {
  loadModel().then(() => {
    sendNotification(app, "Model loaded", "The model is ready to use.");
    createTray();
    createWindow();
    mainWindow.hide();

    // Register global shortcuts
    globalShortcut.register("CommandOrControl+Space", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
          focusInput();
        }
      } else {
        createWindow();
      }
    });
  });
});

// App will quit when all windows are closed, except on macOS (darwin)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
