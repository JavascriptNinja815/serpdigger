function _sendEvent(name, data, response) {
  chrome.runtime.sendMessage(
    {
      eventName: name,
      eventData: data
    },
    response
  );
}

const initCallbacks = [];

function _onInit(callback) {
  initCallbacks.push(callback);
}

function init() {
  $.getJSON("../manifest.json", manifest => {
    $("#version").html(manifest.version);
  });
  initCallbacks.forEach(c => {
    c();
  });
}

$(init);
