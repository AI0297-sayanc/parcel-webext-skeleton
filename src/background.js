const SW_API_URL = "https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping"
// set the initial option values
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    DELAY_BETWEEN_SCRAPES: 10, //seconds
    COOL_DOWN_MINUTES: 10,
    START_COOL_DOWN_AFTER_MINUTES: 15,
    CLOSE_TAB_AFTER_SCRAPING: true,
    GET_URL_TO_SCRAPE_EP: "https://aida-dataapi.aggregateintelligence.com/geturl/",
    SEND_HTML_EP: "https://aida-dataapi.aggregateintelligence.com/postdata/",

    isSessionRunning: false,
    isCoolingDown: false,
    currentTabId: null,
    currentlyScraping: {
      id: null,
      url: null
    }
  })
})

// Promisified helper function to fetch all stored options:
// Reads all data out of storage.sync and exposes it via a promise.
//
// Note: Once the Storage API gains promise support, this function
// can be greatly simplified.
function getAllStorageSyncData() {
  // Immediately return a promise and start asynchronous work
  return new Promise((resolve, reject) => {
    // Asynchronously fetch all data from storage.sync.
    chrome.storage.sync.get(null, (items) => {
      // Pass any observed errors down the promise chain.
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      // Pass the data retrieved from storage down the promise chain.
      resolve(items);
    });
  });
}

// Helper function to "sleep"
async function delay(seconds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve()
    }, seconds * 1000);
  })
}

// function to get url+id to scrape and store it
async function getUrlToScrape() {
  const { GET_URL_TO_SCRAPE_EP: ep } = await getAllStorageSyncData()
  const response = await fetch(ep, {
    method: "POST",
    headers: {
      "X-Request-ID": "SW-key-AI-getaccess23061995-process",
      "Content-Type": "application/json",
      "Accept": "application/json"
      // "Content-Type": "application/x-www-form-urlencoded",
    },
    body: JSON.stringify({
      requesturl: "string"
    })
  })
  const { url, id } = await response.json()
  chrome.storage.sync.set({ currentlyScraping: { id, url } })
}

// function to send scraped html to EP
async function sendHTMLToEP(data) {
  const { SEND_HTML_EP: ep, currentlyScraping: { id, url } } = await getAllStorageSyncData()
  console.log("==> Posting HTML to EP ", ep)
  await fetch(ep, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
      // "Content-Type": "application/x-www-form-urlencoded",
    },
    body: JSON.stringify({
      id,
      url,
      data,
      "X-Request-ID": "SW-key-AI-getaccess23061995-process"
    })
  })
}

// function to initiate the scraping process by opening the target site in a new tab & storing its ID
async function startScraping() {
  try {
    await getUrlToScrape()
    const { currentlyScraping: { url } } = await getAllStorageSyncData()
    // Open an EMPTY new tab and store its id
    const { id: currentTabId } = await chrome.tabs.create({ url: "" })
    chrome.storage.sync.set({ currentTabId })
    // Attach debugger to the opened tab
    await chrome.debugger.attach({ tabId: currentTabId }, "1.0")
    // then enable Network debugging
    await chrome.debugger.sendCommand({ tabId: currentTabId }, "Network.enable")
    // ...and then navigate to the target site
    await chrome.tabs.update(currentTabId, { url })
  } catch (error) {
    console.log("==> startScraping ERROR: ", error)
  }
}

// Start scraping the first time on session start (on msg coming from popup.js)
chrome.runtime.onMessage.addListener(
  async (request, sender, sendResponse) => {
    if (request.startScraping === 1) {
      await startScraping()
    }
    return true
  }
)

// Handle the cool down start and stop inside onAlarm handlers
chrome.alarms.onAlarm.addListener(async ({
  name: alarmName
}) => {
  const {
    isSessionRunning,
    isCoolingDown,
    START_COOL_DOWN_AFTER_MINUTES,
    COOL_DOWN_MINUTES,
  } = await getAllStorageSyncData()
  if (alarmName === "toggleCoolDown") {
    const toggledCoolDownState = !isCoolingDown
    console.log("toggledCoolDownState ==> ", toggledCoolDownState)
    chrome.storage.sync.set({
      isCoolingDown: toggledCoolDownState
    })
    await chrome.alarms.create("toggleCoolDown", {
      delayInMinutes: (toggledCoolDownState === true) ? COOL_DOWN_MINUTES : START_COOL_DOWN_AFTER_MINUTES
    })
    if (toggledCoolDownState === false && isSessionRunning) await startScraping()
  }
})

// Finish Scraping, and start next scraping after a short delay (provided it is not currently cooling down & a session is running)
chrome.debugger.onEvent.addListener(async function(debuggeeId, message, params) {
  const {
    currentTabId,
    currentlyScraping,
    DELAY_BETWEEN_SCRAPES,
    CLOSE_TAB_AFTER_SCRAPING
  } = await getAllStorageSyncData()

  if (currentTabId != debuggeeId.tabId) return
  if (message != "Network.responseReceived" || params.response?.url !== SW_API_URL) return
  console.log("message, params ==> ", message, params)

  chrome.debugger.sendCommand({ // await on sendCommand() doesn't seem to work (result is undefined)! Use callbacks!
    tabId: currentTabId
  }, "Network.getResponseBody", {
    "requestId": params.requestId
  }, async function (resp) {
    console.log("resp ==> ", resp)
    const data = resp?.body || `${params.response.status}: ${params.response.statusText}`
    await sendHTMLToEP(data)

    if (CLOSE_TAB_AFTER_SCRAPING === true) {
      await chrome.tabs.remove(currentTabId)
    } else {
      await chrome.debugger.detach(debuggeeId)
    }
    await delay(DELAY_BETWEEN_SCRAPES)
    const { isSessionRunning, isCoolingDown } = await getAllStorageSyncData()
    if (isSessionRunning && !isCoolingDown) await startScraping()
  })

})

// Fallback to start next scraping in case last scraping failed
chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
  const { currentTabId, DELAY_BETWEEN_SCRAPES } = await getAllStorageSyncData()
  if (tabId === currentTabId && changeInfo.status === "complete") {
    await delay(DELAY_BETWEEN_SCRAPES * 2) // give some time for last scraping to finish
    const { isSessionRunning, isCoolingDown, currentTabId: belatedCurrentTabId } = await getAllStorageSyncData()
    if (!isSessionRunning || isCoolingDown) return
    if (belatedCurrentTabId === tabId) await startScraping() // we are still scraping the old tab (i.e. last scraping was NOT finished & next scraping was not started, probably due to an error). so start next scraping anyway.
  }
})