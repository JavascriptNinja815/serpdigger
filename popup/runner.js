/* eslint-disable no-nested-ternary */
log = new Log("popupRunner");
setTimeout(() => {
  $login = $("#login");
  $loginModal = $("#login-modal");
  $cseAddressInput = $("#cse-address-input");
  $keywordInput = $("#keyword-input");
  $locationInput = $("#location-input");
  $delayInput = $("#delay-input");
  $queryStatusText = $("#query-status-text");
  $deepSearchStatusText = $("#deep-search-status-text");
  $deepSearchInfo = $("#deep-search-info");
  $progressIndicator = $("#progress-indicator");
  $currentQuery = $("#current-query");
  $currentQueryText = $("#current-query-text");
  $collectedUrls = $("#collected-urls");
  $collectedUrlsSubtext = $("#collected-urls-subtext");
  $collectedUrlsCounter = $("#collected-urls-counter");
  $runnerStatusQuery = $("#runner-status-query");
  $progressRunning = $("#progress-running");
  $runnerStatusIndicator = $("#runner-status-indicator");
  $runnerStatusText = $("#runner-status-text");
  $hotkeyTip = $("#hotkey-tip");
  $keyboardNavigationTip = $("#keyboard-navigation-tip");
  $keyboardNavigationCtrlTip = $("#keyboard-navigation-ctrl-tip");
  $realtimePreviewTip = $("#realtime-preview-tip");
  $userFriendlyStatus = $("#user-friendly-status");
  $userFriendlyStatusText = $("#user-friendly-status-text");
  $userFriendlyStatusArrow = $("#user-friendly-status-arrow");
  $totalQueries = $("#total-queries");
  $buyNowButton = $("#buy-now-button");
  $toggle = $("#toggle");
  $help = $("#help");
  $previewModal = $("#preview-modal");
  $previewDownload = $("#preview-download");
  $partialDownload = $("#partial-download");
  $partialDownloadBadge = $("#partial-download-badge");
  $hiddenTableContent = $("#hidden-table-content");
  $loader = $("#loader");
  $tableFooter = $("#table-footer");
  $table = $("#table");
  backgroundPage.serpdigger.runner.miscellaneous.isDomElementsLoaded = true;
}, 0);
backgroundPage.serpdigger.runner.miscellaneous.isDomElementsLoaded = false;
backgroundPage.serpdigger.runner.miscellaneous.isTableContentVisible = false;
backgroundPage.serpdigger.runner.miscellaneous.canUpdateUIMessage = true;
backgroundPage.serpdigger.runner.miscellaneous.canForceToggleUIMessage = true;
const cseAddressValidFormat = /^https:\/\/cse\.google\.[a-z]{2,3}\/cse\?cx=(.*)$/;
const DJMInstance = backgroundPage.serpdigger.runner.modules.DJM;
const message = new Message();
const helper = {};

Offline.options = {
  checks: { xhr: { url: "http://www.google.com" } },
  checkOnLoad: false,
  interceptRequests: true,
  reconnect: {
    initialDelay: 3,
    delay: 10
  },
  requests: true
};

function checkIfIsBackOnline(e) {
  $(".trial").hide();
  updateAccountStatus(null, null, () => {});
  let { checkingAccount } = backgroundPage.serpdigger;
  restoreState();
  const interval = setInterval(() => {
    ({ checkingAccount } = backgroundPage.serpdigger);
    if (!checkingAccount) {
      clearInterval(interval);
      const { tab } = backgroundPage.serpdigger.runner.current;
      if (!tab) return;
      chrome.storage.local.get("PendingRefreshAfterInternetGone", items => {
        if (items.PendingRefreshAfterInternetGone) {
          backgroundPage.serpdigger.runner.miscellaneous.pendingResumeAfterInternetBack = true;
          chrome.tabs.reload(tab.id);
          log.i("Internet back!");
        }
      });
    }
  }, 100);
}

Offline.on("up", checkIfIsBackOnline);
Offline.on("down", () => {
  chrome.storage.local.set({ PendingRefreshAfterInternetGone: true });
  log.w("Internet gone!");
});

async function setBackgroundDJMResult(result) {
  backgroundPage.serpdigger.runner.miscellaneous.lastDJMIntervalSiteResult = result;
  chrome.storage.local.set({ BackgroundDJMResult: result });
}

function debounce(callback, waitTime) {
  let timeout;
  return (...args) => {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => callback.apply(context, args), waitTime);
  };
}

function showCompletedStats(isToggleKeyboardNavigation = false) {
  // Shows the final status everytime popup is shown till the user download the results
  const { paid } = backgroundPage.serpdigger;
  const { complete, stopped, urlsFoundInfo, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { downloaded, downloadedAs } = backgroundPage.serpdigger.runner.download;
  const { saveDialogOpened } = backgroundPage.serpdigger.runner.download;
  // Completed Stats will be shown whether the process was completed or stopped and urls hasn't been downloaded as complete yet
  // or whether urls were downloaded as Trial (10 urls) and user is logged now (allowing to download the full list)
  const canDownloadFullListNow = downloaded && paid && downloadedAs === "TRIAL" && urlsFoundInfo.length > 10;
  const noNewUrlsSinceLastPartialDownload = downloaded && downloadedAs === "PARTIAL" && partialDownloadInfo.urlsAdded === 0;
  if (((stopped && urlsFoundInfo.length > 0) || complete) && (!downloaded || downloadedAs === "PARTIAL" || canDownloadFullListNow)) {
    if (!isToggleKeyboardNavigation) {
      $previewDownload.attr("disabled", false);
      $previewDownload
        .removeClass()
        .addClass(`btn btn-lg btn-block btn-success ${!noNewUrlsSinceLastPartialDownload ? "pulsate-fwd" : ""}`);
    }
    if (!paid) {
      updateDownloadButtonText(
        `${helper.keyboardNavigationEnabled ? "[D]" : "D"}${
          urlsFoundInfo.length < 10 ? "OWNLOAD" : `OWNLOAD ${helper.keyboardNavigationEnabled ? "1ST" : "FIRST"} 10`
        }`
      );
    } else if (downloaded && downloadedAs === "TRIAL") updateDownloadButtonText(`${helper.keyboardNavigationEnabled ? "[D]" : "D"}OWNLOAD`);
    else if (noNewUrlsSinceLastPartialDownload)
      updateDownloadButtonText(`${helper.keyboardNavigationEnabled ? "[D]" : "D"}OWNLOAD AGAIN`);
    else if (!isToggleKeyboardNavigation && urlsFoundInfo.length > 0 && !saveDialogOpened) addDownloadButtonPulsate();
    if (isToggleKeyboardNavigation) return;
    if (stopped) {
      updateProcessStatusIndicatorText("STOPPED", "text-danger");
      updateUserFriendlyStatusText(false);
    } else if (complete) {
      updateProcessStatusIndicatorText("COMPLETE", urlsFoundInfo.length > 0 ? "text-success" : "text-muted");
      updateUserFriendlyStatusText();
      updateUrlsFoundControls(urlsFoundInfo.length, urlsFoundInfo.length > 0 ? "text-success" : "text-muted", true);
    }
    updateUserFriendlyStatusArrow();
    showProcessStatusIndicator();
    showCollectedUrlsCounter();
    if (paid) showUserFriendlyStatus();
    else showBuyNowButton();
  } else if ((stopped || complete) && downloaded && urlsFoundInfo.length > 0) {
    if (!isToggleKeyboardNavigation) {
      $previewDownload.attr("disabled", false);
      $previewDownload.removeClass().addClass("btn btn-lg btn-block btn-outline-success");
    }
    updateDownloadButtonText(`${helper.keyboardNavigationEnabled ? "[D]" : "D"}OWNLOAD AGAIN`);
  }
}

async function disableInputs(
  v,
  cseAddressInput = $cseAddressInput,
  keywordInput = $keywordInput,
  locationInput = $locationInput
) {
  cseAddressInput.attr("disabled", v);
  keywordInput.attr("disabled", v);
  locationInput.attr("disabled", v);
}

async function showProgressIndicator() {
  if (!helper.previousSpinner) return;
  $progressIndicator
    .removeClass(`spinner-${helper.previousSpinner} spinner-${helper.previousSpinner}-sm`)
    .addClass(`spinner-border spinner-border-sm`);
  helper.previousSpinner = "border";
}

async function updateProgressIndicator(progressIndicator = $progressIndicator) {
  const { running, waiting, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { saveDialogOpened } = backgroundPage.serpdigger.runner.download;
  const isSearching = !(waiting || partialDownloadInfo.preparing || saveDialogOpened);
  if (running) {
    const spinnerToShow = isSearching ? "border" : "grow";
    if (spinnerToShow === helper.previousSpinner) return;
    progressIndicator
      .removeClass(`spinner-${helper.previousSpinner} spinner-${helper.previousSpinner}-sm`)
      .addClass(`spinner-${spinnerToShow} spinner-${spinnerToShow}-sm`);
    helper.previousSpinner = spinnerToShow;
  } else progressIndicator.removeClass(`spinner-border spinner-border-sm spinner-grow spinner-grow-sm`);
}

const formatNumber = n =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: 0
  });

async function counter(control, countFrom, countTo, animated = false) {
  setTimeout(() => {
    control.removeClass("pulsate-fwd-counter");
  }, 0);
  if (!animated || countTo === 1) {
    if (countTo === 1) {
      setTimeout(() => {
        control.addClass("pulsate-fwd-counter");
      }, 0);
    }
    control.text(formatNumber(countTo));
  } else if (animated) {
    setTimeout(() => {
      control.each(function _() {
        const $this = $(this);
        const duration = 300;
        $({
          countNum: countFrom
        }).animate(
          {
            countNum: countTo
          },
          {
            duration,
            easing: "swing",
            step() {
              const formatted = formatNumber(this.countNum);
              $this.addClass("pulsate-fwd-counter");
              $this.text(formatted);
            },
            complete() {
              $this.removeClass("pulsate-fwd-counter");
              setTimeout(() => {
                /*
                Enclosing the refreshing of the last value as async, 
                avoids interrupting the animation above
                */
                const formatted = countTo < 999999999 ? formatNumber(countTo) : `+${formatNumber(999999999)}`;
                $this.text(formatted);
              }, 0);
            }
          }
        );
      });
    }, 0);
  }
}

async function updateUrlsFoundControls(
  countTo,
  addClass,
  animated = false,
  collectedUrls = $collectedUrls,
  collectedUrlsSubtext = $collectedUrlsSubtext
) {
  helper.previousCountTo = helper.previousCountTo || 0;
  counter(collectedUrls, helper.previousCountTo, countTo, animated);
  collectedUrls.removeClass("text-muted text-success").addClass(addClass);
  collectedUrlsSubtext.removeClass("text-muted text-success").addClass(addClass);
  helper.previousCountTo = countTo;
}

function showCollectedUrlsCounter(collectedUrlsCounter = $collectedUrlsCounter) {
  collectedUrlsCounter.show();
}

function hideCollectedUrlsCounter() {
  $collectedUrlsCounter.hide();
}

async function updateCollectedUrlsSubtext(s, collectedUrlsSubtext = $collectedUrlsSubtext) {
  collectedUrlsSubtext.text(s);
}

async function updateCurrentQueryNumber(n, currentQuery = $currentQuery) {
  currentQuery.text(n);
}

async function updateQueryStatusText(s, queryStatusText = $queryStatusText) {
  queryStatusText.text(s);
}

async function updateCurrentQueryText(s, currentQueryText = $currentQueryText) {
  currentQueryText.text(s);
}

async function updateDeepSearchStatusText(s, deepSearchStatusText = $deepSearchStatusText) {
  deepSearchStatusText.text(s);
}

function showCurrentQueryContent(runnerStatusQuery = $runnerStatusQuery) {
  runnerStatusQuery.show();
}

function hideCurrentQueryContent() {
  $runnerStatusQuery.hide();
}

function showProgressStatusIndicator(progressRunning = $progressRunning) {
  progressRunning.show();
}

function hideProgressStatusIndicator() {
  $progressRunning.hide();
}

function showProcessStatusIndicator() {
  $runnerStatusIndicator.show();
}

function hideProcessStatusIndicator() {
  $runnerStatusIndicator.hide();
}

async function updateProcessStatusIndicatorText(s, c) {
  $runnerStatusText.text(s);
  if (c !== undefined && c !== null) {
    $runnerStatusText.removeClass("text-muted text-success text-danger").addClass(c);
  }
}

function showHotkeyTip(
  hotkeyTip = $hotkeyTip,
  keyboardNavigationTip = $keyboardNavigationTip,
  deepSearchInfo = $deepSearchInfo,
  realtimePreviewTip = $realtimePreviewTip,
  fadeIn = true
) {
  hideDeepSearchInfo(deepSearchInfo);
  hideRealtimePreviewTip(realtimePreviewTip);
  hideKeyboardNavigationTip(keyboardNavigationTip);
  hideKeyboardNavigationCtrlTip();
  helper.hotkeyTipVisible = true;
  if (fadeIn)
    hotkeyTip.fadeIn(500, () => {
      if (helper.hotkeyTipVisible) hotkeyTip.show();
    });
  else hotkeyTip.show();
}

function hideHotkeyTip(hotkeyTip = $hotkeyTip) {
  helper.hotkeyTipVisible = false;
  hotkeyTip.hide();
}

function showKeyboardNavigationTip(
  keyboardNavigationTip = $keyboardNavigationTip,
  hotkeyTip = $hotkeyTip,
  deepSearchInfo = $deepSearchInfo,
  realtimePreviewTip = $realtimePreviewTip,
  fadeIn = true
) {
  hideDeepSearchInfo(deepSearchInfo);
  hideRealtimePreviewTip(realtimePreviewTip);
  hideHotkeyTip(hotkeyTip);
  hideKeyboardNavigationCtrlTip();
  helper.keyboardNavigationTipVisible = true;
  if (fadeIn)
    keyboardNavigationTip.fadeIn(500, () => {
      if (helper.keyboardNavigationTipVisible) keyboardNavigationTip.show();
    });
  else keyboardNavigationTip.show();
}

function hideKeyboardNavigationTip(keyboardNavigationTip = $keyboardNavigationTip) {
  helper.keyboardNavigationTipVisible = false;
  keyboardNavigationTip.hide();
}

function showRealtimePreviewTip(
  realtimePreviewTip = $realtimePreviewTip,
  hotkeyTip = $hotkeyTip,
  keyboardNavigationTip = $keyboardNavigationTip,
  deepSearchInfo = $deepSearchInfo,
  fadeIn = true
) {
  hideHotkeyTip(hotkeyTip);
  hideKeyboardNavigationTip(keyboardNavigationTip);
  hideDeepSearchInfo(deepSearchInfo);
  hideKeyboardNavigationCtrlTip();
  helper.realtimePreviewTipVisible = true;
  if (fadeIn)
    realtimePreviewTip.fadeIn(500, () => {
      if (helper.realtimePreviewTipVisible) realtimePreviewTip.show();
    });
  else realtimePreviewTip.show();
}

function hideRealtimePreviewTip(realtimePreviewTip = $realtimePreviewTip) {
  helper.realtimePreviewTipVisible = false;
  realtimePreviewTip.hide();
}

function showDeepSearchInfo(
  deepSearchInfo = $deepSearchInfo,
  hotkeyTip = $hotkeyTip,
  keyboardNavigationTip = $keyboardNavigationTip,
  realtimePreviewTip = $realtimePreviewTip,
  fadeIn = true
) {
  hideHotkeyTip(hotkeyTip);
  hideKeyboardNavigationTip(keyboardNavigationTip);
  hideRealtimePreviewTip(realtimePreviewTip);
  hideKeyboardNavigationCtrlTip();
  helper.deepSearchInfoVisible = true;
  if (fadeIn)
    deepSearchInfo.fadeIn(500, () => {
      if (helper.deepSearchInfoVisible) deepSearchInfo.show();
    });
  else deepSearchInfo.show();
}

function hideDeepSearchInfo(deepSearchInfo = $deepSearchInfo) {
  helper.deepSearchInfoVisible = false;
  deepSearchInfo.hide();
}

function showKeyboardNavigationCtrlTip() {
  hideDeepSearchInfo();
  hideRealtimePreviewTip();
  hideHotkeyTip();
  hideKeyboardNavigationTip();
  helper.keyboardNavigationCtrlTipVisible = true;
  $keyboardNavigationCtrlTip.fadeIn(500, () => {
    if (helper.keyboardNavigationCtrlTipVisible) $keyboardNavigationCtrlTip.show();
  });
}

function hideKeyboardNavigationCtrlTip() {
  helper.keyboardNavigationCtrlTipVisible = false;
  if ($keyboardNavigationCtrlTip) $keyboardNavigationCtrlTip.hide();
}

function showUserFriendlyStatus() {
  $userFriendlyStatus.show();
}

function hideUserFriendlyStatus() {
  $userFriendlyStatus.hide();
}

async function updateUserFriendlyStatusText(complete = true) {
  let friendlyStatusText = "";
  const { urlsFoundInfo, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { downloaded, downloadedAs } = backgroundPage.serpdigger.runner.download;
  const textClass = urlsFoundInfo.length > 0 ? "text-success" : "text-danger";
  if (downloaded && downloadedAs === "PARTIAL" && partialDownloadInfo.urlsAdded === 0)
    friendlyStatusText = "There're no new urls since last partial download";
  else if (urlsFoundInfo.length > 1)
    friendlyStatusText = complete ? "All done! Your full list is now ready for download ;)" : "Nice! You got some urls.";
  else if (urlsFoundInfo.length === 1)
    friendlyStatusText = complete
      ? "You got one url only. You can try again with more queries."
      : "Nice! You got some urls. (Just one to be honest)";
  else friendlyStatusText = `No urls found :(${complete ? " Maybe you should click on the help button above." : ""}`;
  $userFriendlyStatusText.text(friendlyStatusText);
  $userFriendlyStatusText.removeClass("text-muted text-success text-danger").addClass(textClass);
}

async function updateUserFriendlyStatusArrow() {
  const { urlsFoundInfo } = backgroundPage.serpdigger.runner.current;
  $userFriendlyStatusArrow.attr("src", urlsFoundInfo.length > 0 ? "../data/arrow_left_green" : "../data/arrow_left_red");
}

async function updateTotalNumberOfQueries(n, totalQueries = $totalQueries) {
  totalQueries.text(n);
}

function isLoginButtonVisible() {
  return $login.is(":visible");
}

function showBuyNowButton(buyNowButton = $buyNowButton) {
  buyNowButton.show();
}

function hideBuyNowButton() {
  $buyNowButton.hide();
}

function isBuyNowButtonVisible() {
  return $buyNowButton.is(":visible");
}

async function removeDownloadButtonPulsate() {
  $previewDownload.removeClass("pulsate-bck");
}

function isDownloadButtonEnabled() {
  return !$previewDownload.is(":disabled");
}

async function updateDownloadButtonText(s, previewDownload = $previewDownload) {
  previewDownload.text(s);
}

function isPartialDownloadButtonEnabled() {
  return !$partialDownload.is(":disabled");
}

async function updatePartialDownloadButtonText(s) {
  $partialDownload.text(s);
}

function showPartialDownloadBadge() {
  $partialDownloadBadge.show();
}

function hidePartialDownloadBadge() {
  $partialDownloadBadge.hide();
}

function isPreviewModalVisible() {
  return $previewModal.is(":visible");
}

function isInputEmpty(control) {
  return control.val().trim().length === 0;
}

function isDelayInputEmpty() {
  return isInputEmpty($delayInput);
}

function cancelDownloadButtonPulsate() {
  clearTimeout(helper.pulsateTimer);
}

function addDownloadButtonPulsate(delay = 10000, previewDownload = $previewDownload) {
  // Waits to set the next transition whether popup is visible and user hasn't download the file yet
  if (helper.pulsateTimer !== undefined && helper.pulsateTimer !== null) cancelDownloadButtonPulsate();
  helper.pulsateTimer = setTimeout(() => {
    if (!previewDownload.hasClass("pulsate-bck")) previewDownload.addClass("pulsate-bck");
  }, delay);
}

function updateTrialContentFromLogin() {
  const { running } = backgroundPage.serpdigger.runner.current;
  updateDownloadButton();
  if (running) {
    hideRealtimePreviewTip();
    hideDeepSearchInfo();
    hideHotkeyTip();
    hideKeyboardNavigationTip();
    showBuyNowButton();
  }
  $toggle.attr("disabled", false);
  backgroundPage.serpdigger.checkingAccount = false;
  showCompletedStats();
}

function updatePaidContentFromLogin() {
  const { complete, stopped, running, urlsFoundInfo } = backgroundPage.serpdigger.runner.current;
  // Disable download button during account checking
  updateDownloadButton();
  if (isBuyNowButtonVisible()) {
    hideBuyNowButton();
    if (running && urlsFoundInfo.length > 0) showRealtimePreviewTip();
    else if (complete || stopped) showUserFriendlyStatus();
  }
  $toggle.attr("disabled", false);
  backgroundPage.serpdigger.checkingAccount = false;
  // Enables download button after account checking
  updateDownloadButton();
  showCompletedStats();
}

async function updatePartialDownloadButtonBadge() {
  const { complete, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { urlsAdded } = partialDownloadInfo;
  if (!urlsAdded || urlsAdded === 0 || complete || partialDownloadInfo.preparing) hidePartialDownloadBadge();
  else {
    $partialDownloadBadge.text(urlsAdded > 999 ? "+999" : urlsAdded);
    if (!$partialDownload.is(":hover")) showPartialDownloadBadge();
  }
}

async function updatePartialDownloadButton(isToggleKeyboardNavigation = false) {
  const { complete, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { saveDialogOpened } = backgroundPage.serpdigger.runner.download;
  if (!isToggleKeyboardNavigation) {
    $partialDownload.removeClass("btn-outline-secondary btn-outline-success");
    $partialDownload.attr("disabled", complete || !!partialDownloadInfo.preparing);
    $partialDownload.addClass(!complete && !partialDownloadInfo.preparing ? "btn-outline-success" : "btn-outline-secondary");
    updatePartialDownloadButtonBadge();
  }
  updatePartialDownloadButtonText(
    !partialDownloadInfo.preparing && !saveDialogOpened
      ? `${helper.keyboardNavigationEnabled ? "[P]" : "P"}ARTIAL DOWNLOAD`
      : partialDownloadInfo.preparing && !saveDialogOpened
      ? "PREPARING..."
      : "DOWNLOADING..."
  );
}

function updateDownloadButton(previewDownload = $previewDownload, isToggleKeyboardNavigation = false) {
  const { complete, stopped } = backgroundPage.serpdigger.runner.current;
  let { delayInputEmptied } = backgroundPage.serpdigger.runner.miscellaneous;
  delayInputEmptied = !!delayInputEmptied;
  const { running, urlsFoundInfo, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { saveDialogOpened, downloaded, downloadedAs } = backgroundPage.serpdigger.runner.download;
  const { checkingAccount } = backgroundPage.serpdigger;
  let addClass = "";
  if (!isToggleKeyboardNavigation) {
    previewDownload.removeClass().addClass("btn btn-lg btn-block");
    cancelDownloadButtonPulsate();
  }
  if (urlsFoundInfo.length > 0) {
    const noNewUrlsSinceLastPartialDownload = downloaded && downloadedAs === "PARTIAL" && partialDownloadInfo.urlsAdded === 0;
    if (backgroundPage.serpdigger.paid) {
      if (!isToggleKeyboardNavigation) {
        if (checkingAccount || partialDownloadInfo.preparing || saveDialogOpened || (delayInputEmptied && running))
          addClass = "btn-outline-secondary";
        else if (complete || stopped) addClass = `btn-success pulsate-fwd`;
        else if (running) addClass = "btn-outline-success";
        previewDownload.addClass(addClass);
      }
      // Disables download button whether is checking account, partial download is preparing or save dialog is open, otherwise enables the button
      const disable = checkingAccount || partialDownloadInfo.preparing || saveDialogOpened || (delayInputEmptied && running);
      previewDownload.attr("disabled", disable);
      updateDownloadButtonText(
        complete || stopped
          ? `${helper.keyboardNavigationEnabled && !disable ? "[D]" : "D"}OWNLOAD${
              !checkingAccount && noNewUrlsSinceLastPartialDownload ? " AGAIN" : ""
            }`
          : !partialDownloadInfo.preparing && !saveDialogOpened
          ? `${helper.keyboardNavigationEnabled && !disable ? "[R]" : "R"}EALTIME PREVIEW`
          : !saveDialogOpened
          ? "PREPARING..."
          : "DOWNLOADING...",
        previewDownload
      );
    } else {
      if (!isToggleKeyboardNavigation) {
        if (!checkingAccount && (complete || stopped)) addClass = `btn-success pulsate-fwd`;
        else if (running && urlsFoundInfo.length >= 10 && !delayInputEmptied)
          addClass = `btn-success ${!saveDialogOpened && (!downloaded || downloadedAs === "PARTIAL") ? "pulsate-bck" : ""}`;
        else if (running) addClass = "btn-outline-secondary";
        previewDownload.addClass(addClass);
      }
      const disable = !previewDownload.hasClass("btn-success");
      previewDownload.attr("disabled", disable);
      if ((complete || stopped) && noNewUrlsSinceLastPartialDownload)
        updateDownloadButtonText(`${helper.keyboardNavigationEnabled && !disable ? "[D]" : "D"}OWNLOAD AGAIN`, previewDownload);
      else if (running && (!downloaded || downloadedAs === "TRIAL" || downloadedAs === "PARTIAL")) {
        updateDownloadButtonText(
          `${helper.keyboardNavigationEnabled && !disable ? "[D]" : "D"}${
            urlsFoundInfo.length < 10 ? "OWNLOAD" : `OWNLOAD ${helper.keyboardNavigationEnabled && !disable ? "1ST" : "FIRST"} 10`
          }`,
          previewDownload
        );
      }
    }
    if (
      !isToggleKeyboardNavigation &&
      !checkingAccount &&
      !saveDialogOpened &&
      (complete || stopped) &&
      (!downloaded || (downloadedAs === "PARTIAL" && partialDownloadInfo.urlsAdded > 0))
    )
      addDownloadButtonPulsate(10000, previewDownload);
  } else if (!isToggleKeyboardNavigation) {
    previewDownload.text("DOWNLOAD");
    previewDownload.addClass("btn-outline-secondary");
    previewDownload.attr("disabled", true);
  }
}

function updateButtons(toggle = $toggle, previewDownload = $previewDownload, isToggleKeyboardNavigation = false) {
  let { running } = backgroundPage.serpdigger.runner.current;
  running = !!running;
  toggle.text(`${helper.keyboardNavigationEnabled ? "[S]" : "S"}${running ? `TOP` : `TART`}`).data("status", running ? "stop" : "start");
  updateDownloadButton(previewDownload, isToggleKeyboardNavigation);
}

async function redFocusInput(control, enabled = true) {
  if (!enabled) control.removeClass("danger-focus");
  else {
    control.addClass("danger-focus");
    control.focus();
  }
}

async function redFocusDelayInput(enabled = true) {
  redFocusInput($delayInput, enabled);
}

async function buildTable(table = $table, tableFooter = $tableFooter) {
  table.bootstrapTable({
    columns: [
      { title: "URL", field: "URL", align: "center", valign: "middle" },
      { title: "KEYWORD", field: "KEYWORD", align: "center", valign: "middle" },
      { title: "LOCATION", field: "LOCATION", align: "center", valign: "middle" }
    ],
    pagination: true,
    pageSize: 100,
    paginationSuccessivelySize: 5,
    paginationPagesBySide: 1,
    pageList: [100, 250],
    formatShowingRows: (pageFrom, pageTo, totalRows) => {
      helper.tableTotalRows = totalRows;
      tableFooter.css("margin-top", totalRows === 0 ? "54px" : "0px");
      return `${pageFrom} to ${pageTo} of <u>${totalRows}</u>`;
    },
    formatSearch: () => "Search (Ctrl+F)"
  });
}

async function updateTable(data = backgroundPage.serpdigger.runner.current.urlsFoundInfo) {
  data.fixedScroll = true;
  $table.bootstrapTable("load", data);
}

async function showCompleteOnPreviewModal() {
  if (!isPreviewModalVisible()) return;
  message.success("Done! File ready for download", 3000, () => {
    if (!isPreviewModalVisible()) return;
    message.info("Closing this window in 5 secs . . .", 5000, () => {
      setTimeout(() => {
        hideCurrentQueryContent();
      }, 0);
      $previewModal.modal("hide");
    });
  });
}

$("#partial-download").hover(
  () => {
    if (backgroundPage.serpdigger.runner.current.partialDownloadInfo.urlsAdded > 0)
      $partialDownloadBadge.stop().fadeOut("fast", () => {
        $partialDownloadBadge.hide();
      });
  },
  () => {
    if (backgroundPage.serpdigger.runner.current.partialDownloadInfo.urlsAdded > 0)
      $partialDownloadBadge.stop().fadeIn("fast", () => {
        $partialDownloadBadge.show();
      });
  }
);

const setNextRunnerTimeOutDebounced = debounce(backgroundPage.setNextRunnerTimeOut, 250);

$("#delay-input").on("change keyup input", async function _() {
  let { delay } = backgroundPage.serpdigger.runner.current;
  const delayInputValue = $(this).val();
  const currentDelay = parseInt(delayInputValue, 10) * 1000;
  backgroundPage.serpdigger.runner.miscellaneous.delayInputEmptied = delayInputValue === "";
  if (!backgroundPage.serpdigger.runner.current.running) return;
  if (delay !== currentDelay) {
    backgroundPage.cancelNextRunner();
    redFocusInput($delayInput, delayInputValue === "");
    updateDownloadButton();
    setTimeout(() => {
      setNextRunnerTimeOutDebounced(currentDelay, true);
    }, 0);
  }
  log.i("before runner : ", $delayInput.val(), delay);
  backgroundPage.serpdigger.runner.current.delay = currentDelay;
  ({ delay } = backgroundPage.serpdigger.runner.current);
  if ((!helper.fullfilledDelay && delay >= 45000) || (helper.fullfilledDelay && delay < 45000)) {
    helper.fullfilledDelay = delay >= 45000;
    DJMInstance._RunDebounced("duringDelay", {
      response: helper.fullfilledDelay ? "fulfilledDelay" : "unfulfilledDelay",
      waitTime: 300
    }).then(result => setBackgroundDJMResult(result));
  }
});

$("#deep-search-enabled").change(async function _() {
  const { deepSearchInfo } = backgroundPage.serpdigger.runner.current;
  backgroundPage.serpdigger.runner.current.deepSearchInfo.enabled = this.checked;
  DJMInstance._RunDebounced("duringDelay", { response: this.checked ? "enabled" : "disabled" }).then(result =>
    setBackgroundDJMResult(result)
  );
  // Immediately cancels deep search whether is running and deep search was disabled
  if (!this.checked && deepSearchInfo.running) {
    backgroundPage.serpdigger.runner.current.deepSearchInfo.running = false;
    backgroundPage.serpdigger.runner.current.deepSearchInfo.statusString = "";
    chrome.tabs.sendMessage(backgroundPage.serpdigger.runner.current.tab.id, {
      eventName: "cancelDeepSearch"
    });
  }
});

function stopProcess() {
  hideProgressStatusIndicator();
  showProcessStatusIndicator();
  backgroundPage.serpdigger.stop();
}

function stopDialog() {
  helper.stopDialogIsVisible = true;
  const dialog = bootbox.dialog({
    size: "sm",
    title: "<img src='../logo/logo-16.png' class='rounded'/> <span style='font-size: 15px; font-weight: 500;'>Serpdigger</span>",
    message: "<span style='font-size: 14.5px;'>Are you sure you want to stop the process?</span>",
    buttons: {
      CANCEL: {
        label: `${helper.keyboardNavigationEnabled ? "[C]" : "C"}ANCEL`,
        className: "cancel btn-sm btn-light active"
      },
      OK: {
        label: `${helper.keyboardNavigationEnabled ? "[E]" : "E"}XACTLY`,
        className: "stop btn-sm btn-primary",
        callback() {
          stopProcess();
        }
      }
    },
    onEscape: true,
    backdrop: true
  });
  dialog.on("hidden.bs.modal", () => {
    helper.stopDialogIsVisible = undefined;
  });
}

$("#toggle").click(async function toogle() {
  log.i("start:", $(this).data("status"));
  if ($(this).data("status") === "stop") {
    if (backgroundPage.serpdigger.runner.current.running) stopDialog();
  } else if (!cseAddressValidFormat.test($cseAddressInput.val())) {
    redFocusInput($cseAddressInput);
    if (!helper.showingMessage && !isInputEmpty($cseAddressInput)) {
      helper.showingMessage = true;
      message.error("CSE address format not valid", 1000, () => {
        helper.showingMessage = false;
      });
    }
  } else if (isInputEmpty($keywordInput)) redFocusInput($keywordInput);
  else if (isInputEmpty($locationInput)) redFocusInput($locationInput);
  else if (isInputEmpty($delayInput)) redFocusInput($delayInput);
  else {
    const queries = await getQueries();
    setTimeout(() => hideProcessStatusIndicator(), 0);
    setTimeout(() => showProgressStatusIndicator(), 0);
    let { checkingAccount, paid } = backgroundPage.serpdigger;
    if (!paid) {
      // To validate whether buy now button has to be shown,
      // waits for checking account status to finish (if running)
      setTimeout(() => {
        if (checkingAccount) {
          const interval = setInterval(() => {
            ({ checkingAccount, paid } = backgroundPage.serpdigger);
            if (!checkingAccount) {
              clearInterval(interval);
              if (!paid) showBuyNowButton();
            }
          }, 100);
        } else if (!paid) showBuyNowButton();
      }, 0);
    } else hideBuyNowButton();
    backgroundPage.serpdigger.run(queries);
  }
});

$("#help").click(() => window.open("http://xtralead.xtralead.com/help", "_blank"));

$("#partial-download").click(() => backgroundPage.serpdigger.download());

$("#preview-download").click(() => {
  const { running } = backgroundPage.serpdigger.runner.current;
  const { tab } = backgroundPage.serpdigger.runner.current;
  if (running) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0].id === tab.id) DJMInstance._Run("duringDelay", { response: "fly" }).then(result => setBackgroundDJMResult(result));
    });
  }
  if (running && backgroundPage.serpdigger.paid) {
    const { waiting, deepSearchInfo } = backgroundPage.serpdigger.runner.current;
    const { canForceToggleUIMessage, uiMessageOnDelayTurn } = backgroundPage.serpdigger.runner.miscellaneous;
    const isSearching = !waiting && !deepSearchInfo.preparing && !deepSearchInfo.running;
    if (canForceToggleUIMessage && isSearching) {
      backgroundPage.serpdigger.runner.miscellaneous.canForceToggleUIMessage = false;
      if (!uiMessageOnDelayTurn || uiMessageOnDelayTurn !== "hotkey") {
        showHotkeyTip();
        backgroundPage.serpdigger.runner.miscellaneous.uiMessageOnDelayTurn = "hotkey";
      } else {
        showKeyboardNavigationTip();
        backgroundPage.serpdigger.runner.miscellaneous.uiMessageOnDelayTurn = "keyboardNavigation";
      }
    }
    // Shows preview modal only when no site is loading
    const interval = setInterval(() => {
      if (!backgroundPage.serpdigger.runner.miscellaneous.loadingSite) {
        $previewModal.modal("show");
        clearInterval(interval);
      }
    }, 0);
  } else backgroundPage.serpdigger.download();
});

$("#preview-modal").on("shown.bs.modal", () => {
  const currentInputValue = $("search").val();
  $("search")
    .attr("placeholder", "new placeholder value")
    .val(currentInputValue);
  const isFirstLoad = helper.tableTotalRows === 0;
  if (isFirstLoad || backgroundPage.serpdigger.runner.miscellaneous.loadingSite) $loader.show();
  updatePartialDownloadButton();
  const interval = setInterval(() => {
    if (!backgroundPage.serpdigger.runner.miscellaneous.loadingSite) {
      clearInterval(interval);
      setTimeout(
        () => {
          $loader.hide();
          $hiddenTableContent.show();
          backgroundPage.serpdigger.runner.miscellaneous.isTableContentVisible = true;
          // Resets view to fix the position of the table on the modal on first load
          $table.bootstrapTable("resetView");
          updateTable();
        },
        isFirstLoad ? 300 : 0
      );
    }
  }, 0);
});

$("#preview-modal").on("hide.bs.modal", () => document.activeElement.tagName !== "INPUT" || $(document.activeElement).val() === "");

function onPreviewModalHide() {
  $hiddenTableContent.hide();
  if (helper.copyUrlDialogIsVisible) return;
  $table.bootstrapTable("resetSearch");
  backgroundPage.serpdigger.runner.miscellaneous.isTableContentVisible = false;
  if (backgroundPage.serpdigger.runner.current.complete) {
    updateTable({});
    hideCurrentQueryContent();
  }
}

$("#preview-modal").on("hidden.bs.modal", async () => onPreviewModalHide());

$(() => {
  const copyToClipboard = async str => {
    const el = document.createElement("textarea");
    el.value = str;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  };
  $("#preview-modal").on("click-row.bs.table", (row, $element, field) => {
    helper.copyUrlDialogIsVisible = true;
    $previewModal.modal("hide");
    const dialog = bootbox.dialog({
      size: "sm",
      title: "<img src='../logo/logo-16.png' class='rounded'/> <span style='font-size: 15px; font-weight: 500;'>Serpdigger</span>",
      message: "<span style='font-size: 14.5px;'>Copy the selected url to clipboard?</span>",
      buttons: {
        CANCEL: {
          label: `${helper.keyboardNavigationEnabled ? "[C]" : "C"}ANCEL`,
          className: "cancel btn-sm btn-light active"
        },
        OK: {
          label: `${helper.keyboardNavigationEnabled ? "[D]" : "D"}O IT!`,
          className: "copy btn-sm btn-primary",
          callback() {
            helper.copyUrlRequest = true;
          }
        }
      },
      onEscape: true,
      backdrop: true
    });
    dialog.on("hidden.bs.modal", () => {
      helper.copyUrlDialogIsVisible = undefined;
      const { running } = backgroundPage.serpdigger.runner.current;
      if (running) {
        $previewModal.modal("show");
        if (helper.copyUrlRequest) {
          copyToClipboard($element.URL);
          if (!helper.showingMessage) {
            helper.showingMessage = true;
            message.info("Url copied to clipboard!", 1200, () => {
              helper.showingMessage = false;
            });
          }
          helper.copyUrlRequest = undefined;
        }
      } else onPreviewModalHide();
    });
  });
});

$("#table").on("search.bs.table", async () => {
  DJMInstance._RunDebounced("duringDelay", { response: "onSearch", waitTime: 250 }).then(result => setBackgroundDJMResult(result));
});

// Handles key detection on inputs
hotkeys.filter = () => true;

hotkeys("l,ctrl+l,s,ctrl+s,e,r,ctrl+r,d,ctrl+d,h,ctrl+h,p,ctrl+p,c", (event, handler) => {
  if (helper.keyboardNavigationEnabled) {
    const { paid } = backgroundPage.serpdigger;
    const { running, complete, stopped } = backgroundPage.serpdigger.runner.current;
    const { isTableContentVisible } = backgroundPage.serpdigger.runner.miscellaneous;
    const { tagName } = event.target;
    if ((tagName === "INPUT" || tagName === "TEXTAREA") && handler.key.length === 1) return;
    switch (handler.key) {
      case "l":
      case "ctrl+l":
        if (isLoginButtonVisible()) $login.click();
        break;
      case "s":
      case "ctrl+s":
        if (!helper.stopDialogIsVisible && !helper.helpDialogIsVisible && !isTableContentVisible) {
          $previewModal.modal("hide");
          $toggle.click();
        } else if (helper.helpDialogIsVisible) hideDialogs();
        break;
      case "e":
        if (helper.stopDialogIsVisible) {
          hideDialogs();
          stopProcess();
        }
        break;
      case "r":
      case "ctrl+r":
        if (running && paid && !helper.stopDialogIsVisible && isDownloadButtonEnabled()) {
          if (handler.key.length === 1) {
            const { waiting, deepSearchInfo } = backgroundPage.serpdigger.runner.current;
            const isSearching = !waiting && !deepSearchInfo.preparing && !deepSearchInfo.running;
            if (isSearching) {
              backgroundPage.serpdigger.runner.miscellaneous.canForceToggleUIMessage = false;
              showKeyboardNavigationCtrlTip();
            }
          }
          $previewDownload.focus(); // Ensures to change focus avoiding to clear text when pressing esc attempting to close modal
          $previewDownload.click();
        }
        break;
      case "d":
      case "ctrl+d":
        if (helper.helpDialogIsVisible) openDocumentation();
        else if (helper.copyUrlDialogIsVisible) $(".modal.bootbox > .modal-dialog > .modal-content > .modal-footer > .copy").click();
        else if (((paid && (complete || stopped)) || !paid) && isDownloadButtonEnabled()) {
          $previewDownload.focus(); // Ensures to change focus avoiding to clear text when pressing esc attempting to close modal
          $previewDownload.click();
        }
        break;
      case "h":
      case "ctrl+h":
        if (!helper.stopDialogIsVisible && !helper.helpDialogIsVisible && !isTableContentVisible) $help.click();
        break;
      case "p":
      case "ctrl+p":
        if (isTableContentVisible && isPartialDownloadButtonEnabled()) $partialDownload.click();
        break;
      case "c":
        hideDialogs();
        break;
      default:
        break;
    }
  }
});

hotkeys("ctrl+f", () => {
  if (backgroundPage.serpdigger.runner.miscellaneous.isTableContentVisible) $("input").focus();
});

function toggleHotkeysTip() {
  helper.keyboardNavigationEnabled = !helper.keyboardNavigationEnabled;
  $login.text(`${helper.keyboardNavigationEnabled ? "[L]" : "L"}OGIN`);
  updateButtons($toggle, $previewDownload, true);
  const { complete, stopped } = backgroundPage.serpdigger.runner.current;
  if ((complete || stopped) && isDownloadButtonEnabled()) showCompletedStats(true);
  $help.text(`${helper.keyboardNavigationEnabled ? "[H]" : "H"}ELP?`);
  if (helper.stopDialogIsVisible) {
    $(".modal.bootbox > .modal-dialog > .modal-content > .modal-footer > .cancel").text(
      `${helper.keyboardNavigationEnabled ? "[C]" : "C"}ANCEL`
    );
    $(".modal.bootbox > .modal-dialog > .modal-content > .modal-footer > .stop").text(
      `${helper.keyboardNavigationEnabled ? "[E]" : "E"}XACTLY`
    );
  } else if (helper.copyUrlDialogIsVisible) {
    $(".modal.bootbox > .modal-dialog > .modal-content > .modal-footer > .cancel").text(
      `${helper.keyboardNavigationEnabled ? "[C]" : "C"}ANCEL`
    );
    $(".modal.bootbox > .modal-dialog > .modal-content > .modal-footer > .copy").text(
      `${helper.keyboardNavigationEnabled ? "[D]" : "D"}O IT!`
    );
  }
  updatePartialDownloadButton(true);
}

window.addEventListener("keyup", event => {
  // keyCode 18 = Alt (keyup to avoid requiring a debounce handler)
  // Hotkeys has an issue when pressing Alt+Tab
  // (Also needs to turn off keyboard navigation on blur event as a workaround to fix the issue)
  if (event.which === 18) toggleHotkeysTip();
});
window.addEventListener("blur", () => {
  // (Turn off keyboard navigation on blur (unfocus) event as a workaround to fix the Alt+Tab issue)
  const { saveDialogOpening, saveDialogOpened } = backgroundPage.serpdigger.runner.download;
  if (saveDialogOpening || saveDialogOpened) return;
  helper.keyboardNavigationEnabled = true;
  toggleHotkeysTip();
});

window.addEventListener("keydown", e => {
  if (e.keyCode === 27) {
    if (helper.stopDialogIsVisible || helper.helpDialogIsVisible) e.preventDefault();
    if (backgroundPage.serpdigger.runner.miscellaneous.isTableContentVisible) {
      e.preventDefault();
      if (document.activeElement.tagName === "INPUT") $(document.activeElement).val("");
      else $previewModal.modal("hide");
    } else if (isLoginButtonVisible()) {
      e.preventDefault();
      $loginModal.modal("hide");
    }
  }
});

function restoreState() {
  const { complete, running, waiting, allQueries } = backgroundPage.serpdigger.runner.current;
  const { queryInfo, urlsFoundInfo, deepSearchInfo, partialDownloadInfo } = backgroundPage.serpdigger.runner.current;
  const { defaultQueryRunningStatus, defaultQueryWaitingStatus, defaultQueryPausedStatus } = backgroundPage.serpdigger.runner.defaults;
  const { defaultQueryResumingStatus, defaultQueryPreparingStatus, defaultDeepSearchStatus } = backgroundPage.serpdigger.runner.defaults;
  let { checkingAccount, paid } = backgroundPage.serpdigger;
  const { saveDialogOpening, saveDialogOpened } = backgroundPage.serpdigger.runner.download;
  const { uiMessageOnDelayTurn, delayInputEmptied } = backgroundPage.serpdigger.runner.miscellaneous;
  updateButtons($("#toggle"), $("#preview-download"));
  disableInputs(running, $("#cse-address-input"), $("#keyword-input"), $("#location-input"));
  // Updates immediately to the last urls found whether the process is not completed, otherwise if was completed in background
  // will be animatedly updated later from 0 to the total of urls found on showCompletedStats function
  if (!complete)
    updateUrlsFoundControls(
      urlsFoundInfo.length,
      urlsFoundInfo.length > 0 ? "text-success" : "text-muted",
      false,
      $("#collected-urls"),
      $("#collected-urls-subtext")
    );
  updateCollectedUrlsSubtext(`unique url${urlsFoundInfo.length !== 1 ? "s" : ""}`, $("#collected-urls-subtext"));
  updateCurrentQueryNumber(
    allQueries.length > 0 ? (!waiting ? queryInfo.currentIndex + 1 : queryInfo.currentIndex) : 0,
    $("#current-query")
  );
  updateTotalNumberOfQueries(allQueries.length, $("#total-queries"));
  if (delayInputEmptied && running) redFocusInput($("#delay-input"), true);
  if (running) {
    const isSearching = !waiting && !deepSearchInfo.preparing && !deepSearchInfo.running;
    if (!paid) {
      // To validate whether buy now button has to be shown,
      // waits for checking account status to finish (if running)
      if (checkingAccount) {
        const interval = setInterval(() => {
          ({ checkingAccount, paid } = backgroundPage.serpdigger);
          if (!checkingAccount) {
            clearInterval(interval);
            if (!paid) showBuyNowButton($("#buy-now-button"));
          }
        }, 100);
      } else if (!paid) showBuyNowButton($("#buy-now-button"));
    } else if (isSearching)
      showRealtimePreviewTip($("#realtime-preview-tip"), $("#hotkey-tip"), $("#keyboard-navigation-tip"), $("#deep-search-info"), false);
    else if (deepSearchInfo.preparing || deepSearchInfo.running || uiMessageOnDelayTurn === "deepSearch")
      showDeepSearchInfo($("#deep-search-info"), $("#hotkey-tip"), $("#keyboard-navigation-tip"), $("#realtime-preview-tip"), false);
    else if (uiMessageOnDelayTurn === "hotkey")
      showHotkeyTip($("#hotkey-tip"), $("#keyboard-navigation-tip"), $("#deep-search-info"), $("#realtime-preview-tip"), false);
    else if (uiMessageOnDelayTurn === "keyboardNavigation")
      showKeyboardNavigationTip($("#keyboard-navigation-tip"), $("#hotkey-tip"), $("#deep-search-info"), $("#realtime-preview-tip"), false);
    updateProgressIndicator($("#progress-indicator"));
    let queryStatus;
    if (waiting) queryStatus = defaultQueryWaitingStatus;
    else if (deepSearchInfo.preparing) queryStatus = defaultQueryPreparingStatus;
    else if (partialDownloadInfo.preparing) queryStatus = defaultQueryPausedStatus;
    else if (partialDownloadInfo.running) {
      if (saveDialogOpening || saveDialogOpened) queryStatus = defaultQueryPausedStatus;
      else queryStatus = defaultQueryResumingStatus;
    } else queryStatus = defaultQueryRunningStatus;
    updateQueryStatusText(queryStatus, $("#query-status-text"));
    updateCurrentQueryText(allQueries[queryInfo.currentIndex], $("#current-query-text"));
    if (deepSearchInfo.running) updateDeepSearchStatusText(defaultDeepSearchStatus, $("#deep-search-status-text"));
    showCurrentQueryContent($("#runner-status-query"));
    showProgressStatusIndicator($("#progress-running"));
    showCollectedUrlsCounter($("#collected-urls-counter"));
    buildTable($("#table"), $("#table-footer"));
  }
}

async function hideDialogs() {
  bootbox.hideAll();
}

async function checkInternetConnection() {
  Offline.check();
}

$(document).ready(() => {
  checkInternetConnection();
  restoreState();
});
