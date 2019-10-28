let PAID = true;

function updatePaidStatus(paid) {
  PAID = paid;
  chrome.extension.getBackgroundPage().serpdigger.paid = paid;
}

function updateAccountStatus(username, password, callback) {
  chrome.extension.getBackgroundPage().serpdigger.checkingAccount = true;
  const popup = chrome.extension.getViews({ type: "popup" })[0];
  if (username && password) {
    setTimeout(() => {
      $(".activated, .trial, #incorrect-login").hide();
      $("#checking-account").show();
    }, 0);
    _sendEvent(
      "account:check",
      {
        username,
        password
      },
      data => {
        if (data.paid) {
          updatePaidStatus(true);
          setTimeout(() => {
            $("#checking-account").hide();
            $(".activated").show();
            popup.updatePaidContentFromLogin();
          }, 0);
        } else {
          updatePaidStatus(false);
          setTimeout(() => {
            $(".activated, #checking-account").hide();
            $(".trial, #incorrect-login").show();
            popup.updateTrialContentFromLogin();
          }, 0);
        }
        callback();
      }
    );
  } else {
    setTimeout(() => {
      $("#checking-account").show();
    }, 0);
    _sendEvent("account:saved", {}, account => {
      if (!account) {
        updatePaidStatus(false);
        setTimeout(() => {
          $(".activated, #checking-account").hide();
          $(".trial").show();
          popup.updateTrialContentFromLogin();
        }, 0);
        callback();
      } else {
        _sendEvent(
          "account:check",
          {
            username: account.username,
            password: account.password
          },
          data => {
            if (data.paid) {
              updatePaidStatus(true);
              setTimeout(() => {
                $(".trial, #checking-account").hide();
                $(".activated").show();
                popup.updatePaidContentFromLogin();
              }, 0);
            } else {
              updatePaidStatus(false);
              setTimeout(() => {
                $(".activated, #checking-account").hide();
                $(".trial").show();
                popup.updateTrialContentFromLogin();
              }, 0);
            }
            callback();
          }
        );
      }
    });
  }
}

function login(username, password, remember, callback) {
  setTimeout(() => {
    $("#login").attr("disabled", true);
  }, 0);
  updateAccountStatus(username, password, () => {
    if (remember) {
      _sendEvent(
        "account:save",
        {
          username,
          password
        },
        () => {
          callback();
        }
      );
    } else {
      callback();
    }
    setTimeout(() => {
      $("#login").attr("disabled", false);
    }, 0);
    if (chrome.extension.getBackgroundPage().serpdigger.paid) {
      setTimeout(() => {
        $("#login-modal").modal("hide");
      }, 0);
    }
  });
}

$(document).ready(() => {
  $("#login-form").on("submit", e => {
    e.preventDefault();
    return false;
  });

  $("#login").on("click", () => {
    login($("#inputUsername").val(), $("#inputPassword").val(), $("#inputRememberMe").get(0).checked, () => {});
  });

  $("#login-modal").on("hidden.bs.modal", () => {
    setTimeout(() => {
      $("#incorrect-login").hide();
    }, 0);
  });

  updateAccountStatus(null, null, () => {});
});
