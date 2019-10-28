serpdigger.account = {
  STORAGE_KEY_USERNAME: "username",
  STORAGE_KEY_PASSWORD: "password"
};

serpdigger.account.saved = callback => {
  chrome.storage.local.get([serpdigger.account.STORAGE_KEY_USERNAME, serpdigger.account.STORAGE_KEY_PASSWORD], items => {
    callback(
      items[serpdigger.account.STORAGE_KEY_USERNAME] && items[serpdigger.account.STORAGE_KEY_PASSWORD]
        ? {
            username: items[serpdigger.account.STORAGE_KEY_USERNAME],
            password: items[serpdigger.account.STORAGE_KEY_PASSWORD]
          }
        : null
    );
  });
};

serpdigger.account.save = (username, password, callback) => {
  const s = {};
  s[serpdigger.account.STORAGE_KEY_USERNAME] = username;
  s[serpdigger.account.STORAGE_KEY_PASSWORD] = password;
  chrome.storage.local.set(s, () => {
    callback();
  });
};

serpdigger.account.clear = callback => {
  chrome.storage.local.remove([serpdigger.account.STORAGE_KEY_USERNAME, serpdigger.account.STORAGE_KEY_PASSWORD], () => {
    callback();
  });
};
