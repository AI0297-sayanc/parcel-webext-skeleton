// Saves options to chrome.storage
function save_options() {
  var DELAY_BETWEEN_SCRAPES = +document.getElementById('DELAY_BETWEEN_SCRAPES').value;
  var COOL_DOWN_MINUTES = +document.getElementById('COOL_DOWN_MINUTES').value;
  var START_COOL_DOWN_AFTER_MINUTES = +document.getElementById('START_COOL_DOWN_AFTER_MINUTES').value;
  var SEND_HTML_EP = document.getElementById('SEND_HTML_EP').value;
  var CLOSE_TAB_AFTER_SCRAPING = document.getElementById('CLOSE_TAB_AFTER_SCRAPING').checked;
  chrome.storage.sync.set({
    DELAY_BETWEEN_SCRAPES, //seconds
    COOL_DOWN_MINUTES,
    START_COOL_DOWN_AFTER_MINUTES,
    SEND_HTML_EP,
    CLOSE_TAB_AFTER_SCRAPING
  }, function () {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function () {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    DELAY_BETWEEN_SCRAPES: 10, //seconds
    COOL_DOWN_MINUTES: 10,
    START_COOL_DOWN_AFTER_MINUTES: 15,
    SEND_HTML_EP: "https://requestbin.com/r/en7ru9svftwam",
    CLOSE_TAB_AFTER_SCRAPING: true
  }, function (items) {
    document.getElementById('DELAY_BETWEEN_SCRAPES').value = items.DELAY_BETWEEN_SCRAPES;
    document.getElementById('COOL_DOWN_MINUTES').value = items.COOL_DOWN_MINUTES;
    document.getElementById('START_COOL_DOWN_AFTER_MINUTES').value = items.START_COOL_DOWN_AFTER_MINUTES;
    document.getElementById('SEND_HTML_EP').value = items.SEND_HTML_EP;
    document.getElementById('CLOSE_TAB_AFTER_SCRAPING').checked = items.CLOSE_TAB_AFTER_SCRAPING;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
  save_options);