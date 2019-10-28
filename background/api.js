serpdigger.api = {};

serpdigger.api.registration = {
  PAID: "paid",
  TRIAL: "trial"
};

serpdigger.api.registration.status = (username, password, callback) => {
  const data = {};
  data[serpdigger.config.api.registration.status.keys.username] = username;
  data[serpdigger.config.api.registration.status.keys.password] = password;

  $.ajax({
    url: serpdigger.config.api.registration.status.url,
    method: serpdigger.config.api.registration.status.method,
    data,
    headers: {
      Authorization: `Basic ${btoa(`${serpdigger.config.api.httpuser}:${serpdigger.config.api.httppass}`)}`
    },
    success: param => {
      callback(param === "VALID|PAID" ? serpdigger.api.registration.PAID : serpdigger.api.registration.TRIAL);
    },
    error: () => {
      callback(serpdigger.api.registration.TRIAL);
    }
  });
};

serpdigger.api.keywords = {};

function _parseKeywords(str) {
  return str
    .split(/[\n]+/g)
    .slice(0, -1)
    .map(arg => {
      const s = arg.split(/\*/g);
      return {
        name: s[0],
        value: s[1]
      };
    });
}

serpdigger.api.keywords.get = callback => {
  $.ajax({
    url: serpdigger.config.api.keywords.url,
    method: serpdigger.config.api.keywords.method,
    cache: false,
    success: param => {
      callback(_parseKeywords(param));
    }
  });
};
