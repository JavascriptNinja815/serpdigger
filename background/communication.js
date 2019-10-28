const listeners = {};

function _addListener(eventName, callback) {
  listeners[eventName] = callback;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let response = false;
  if (Object.prototype.hasOwnProperty.call(listeners, request.eventName)) {
    listeners[request.eventName](request.eventData, sender, sendResponse);
    response = true;
  }
  return response;
});

_addListener("account:saved", (data, sender, respond) => {
  serpdigger.account.saved(saved => {
    respond(saved);
  });
});

_addListener("account:check", (data, sender, respond) => {
  serpdigger.api.registration.status(data.username, data.password, status =>
    respond({
      paid: status === serpdigger.api.registration.PAID
    })
  );
});

_addListener("account:save", (data, sender, respond) => {
  serpdigger.account.save(data.username, data.password, () => {
    respond();
  });
});

_addListener("api:keywords", (data, sender, respond) => {
  serpdigger.api.keywords.get(keywords => {
    respond(keywords);
  });
});
