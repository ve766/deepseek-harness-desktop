const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");

let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "DeepSeek Harness",
    webPreferences: {
      contextIsolation: true
    }
  });

  mainWindow.loadURL("http://localhost:3080");
}

app.whenReady().then(() => {

  server = spawn(
    "pnpm",
    ["run", "dsh", "--", "web"],
    {
      shell: true,
      cwd: process.cwd()
    }
  );

  setTimeout(() => {
    createWindow();
  }, 10000);

});


app.on("window-all-closed", () => {
  if (server) server.kill();
  app.quit();
});