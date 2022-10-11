const startSessionBtn = document.getElementById("start-session");

chrome.storage.sync.get("isSessionRunning", ({
  isSessionRunning
}) => {
  if (isSessionRunning === true) {
    startSessionBtn.innerHTML = "Stop Session"
  } else {
    startSessionBtn.innerHTML = "Start Session"
  }
});


// When the button is clicked, take action related to toggle session
startSessionBtn.addEventListener("click", async () => {
  chrome.storage.sync.get(["START_COOL_DOWN_AFTER_MINUTES", "isSessionRunning"], async ({
    START_COOL_DOWN_AFTER_MINUTES,
    isSessionRunning
  }) => {
    if (isSessionRunning === false) { // setup the recurring calls and toggle cool down alarm
      chrome.storage.sync.set({
        isSessionRunning: true
      })
      startSessionBtn.innerHTML = "Stop Session"
      await chrome.alarms.create("toggleCoolDown", {
        delayInMinutes: +START_COOL_DOWN_AFTER_MINUTES
      })
      chrome.runtime.sendMessage({
        startScraping: 1
      })
      console.log("==> Session Started...");
    } else { // session already running: stop it
      chrome.storage.sync.set({ // RESET
        isSessionRunning: false,
        isCoolingDown: false,
        currentTabId: null,
        currentlyScraping: {
          id: null,
          url: null
        }
      })
      startSessionBtn.innerHTML = "Start Session"
      await chrome.alarms.clearAll()
      console.log("==> Session Stopped...");
    }
  })
});