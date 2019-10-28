const log = new Log("background");
const REMOVE_EMAIL_FORMAT_REGEXP = /@\s{0,2}(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\s{0,2}\.\s{0,2})+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/gi;
const defaultIntervalSite = `chrome-extension://${chrome.runtime.id}/background.html`;
const defaultPreparingDeepSearchSite = "about:blank";
const defaultStoppedSite = defaultIntervalSite;
const defaultFinishedSite = "http://roi.im/";

DJM._LoadJSONFileAsync("http://www.xtralead.xtralead.com/dynamic-messages.json");

serpdigger.runner = {
  modules: {
    DJM
  },
  defaults: {
    defaultQueryRunningStatus: "Now running :",
    defaultQueryWaitingStatus: "Next query :",
    defaultQueryStoppedStatus: "Last query :",
    defaultQueryPausedStatus: "Paused on :",
    defaultQueryResumingStatus: "Resuming on :",
    defaultQueryPreparingStatus: "Preparing :",
    defaultDeepSearchStatus: "(Deep Search)"
  },
  current: {
    running: false,
    complete: false,
    stopped: false,
    waiting: false,
    tab: null,
    queryInfo: {},
    allQueries: [],
    emailsFoundInfo: [],
    emailsToExclude: [],
    partialDownloadInfo: {},
    deepSearchInfo: {},
    searchHasResults: false,
    deepSearchHasResults: false,
    nextRunnerInterval: null,
    delay: 10000
  },
  miscellaneous: {
    isDomElementsLoaded: false,
    loadingSite: false,
    lastSearchResultsPage: 0,
    longestEmailLength: 0,
    longestKeywordLength: 0,
    longestLocationLength: 0,
    delayInputEmptied: false,
    uiMessageOnDelayTurn: "",
    canForceToggleUIMessage: false,
    canUpdateUIMessage: false,
    isTableContentVisible: false,
    lastDJMIntervalSiteResult: {},
    pendingResumeAfterInternetBack: false
  },
  download: {
    saveDialogOpening: false,
    saveDialogOpened: false,
    downloadId: 0,
    downloaded: false,
    downloadedAs: ""
  }
};

chrome.storage.local.get("delay", items => {
  if (items.delay !== undefined && items.delay !== null) serpdigger.runner.current.delay = items.delay * 1000;
});

async function restoreDeepSearchState() {
  chrome.storage.local.get("deepSearchEnabled", items => {
    if (items.deepSearchEnabled !== undefined && items.deepSearchEnabled !== null)
      serpdigger.runner.current.deepSearchInfo.enabled = items.deepSearchEnabled;
  });
}

async function setBackgroundDJMResult(result) {
  serpdigger.runner.miscellaneous.lastDJMIntervalSiteResult = result;
  chrome.storage.local.remove(["BackgroundDJMResult"]);
  chrome.storage.local.set({ BackgroundDJMResult: result });
}

const formatNumber = n =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: 0
  });

function onResponse(request, sender) {
  log.i("runtime.onMessage", request.eventName, sender);
  const { tab, queries, allQueries, emailsToExclude } = serpdigger.runner.current;
  const { queryInfo, emailsFoundInfo, deepSearchInfo, partialDownloadInfo } = serpdigger.runner.current;
  let { searchHasResults } = serpdigger.runner.current;
  const { downloaded, downloadedAs } = serpdigger.runner.download;
  let { longestEmailLength, longestKeywordLength, longestLocationLength } = serpdigger.runner.miscellaneous;
  let [popup] = chrome.extension.getViews({ type: "popup" });
  if (!serpdigger.runner.miscellaneous.isDomElementsLoaded) popup = undefined;
  let isNewEmailsAdded = false;
  if (request.eventName === "runner:update") {
    request.eventData.emails.forEach(email => {
      let isUniqueEmail = true;
      for (let i = 0, j = emailsFoundInfo.length; i < j; i++) {
        ({ longestEmailLength, longestKeywordLength, longestLocationLength } = serpdigger.runner.miscellaneous);
        const isThisEmailLonger = emailsFoundInfo[i].EMAIL.length > longestEmailLength;
        serpdigger.runner.miscellaneous.longestEmailLength = isThisEmailLonger ? emailsFoundInfo[i].EMAIL.length : longestEmailLength;
        const isThisKeywordLonger = emailsFoundInfo[i].KEYWORD.length > longestKeywordLength;
        serpdigger.runner.miscellaneous.longestKeywordLength = isThisKeywordLonger
          ? emailsFoundInfo[i].KEYWORD.length
          : longestKeywordLength;
        const isThisLocationLonger = emailsFoundInfo[i].LOCATION.length > longestLocationLength;
        serpdigger.runner.miscellaneous.longestLocationLength = isThisLocationLonger
          ? emailsFoundInfo[i].LOCATION.length
          : longestLocationLength;
        if (emailsFoundInfo[i].EMAIL === email) {
          isUniqueEmail = false;
          break;
        }
      }
      if (isUniqueEmail) {
        const [keyword, , location] = queries[queryInfo.currentIndex];
        const resultInfo = {};
        resultInfo.EMAIL = email;
        resultInfo.KEYWORD = keyword;
        resultInfo.LOCATION = location;
        emailsFoundInfo[emailsFoundInfo.length] = JSON.parse(JSON.stringify(resultInfo));
        if (!deepSearchInfo.running) emailsToExclude[emailsToExclude.length] = email;
        if (emailsFoundInfo.length === 1) {
          serpdigger.runner.miscellaneous.longestEmailLength = emailsFoundInfo[0].EMAIL.length;
          serpdigger.runner.miscellaneous.longestKeywordLength = emailsFoundInfo[0].KEYWORD.length;
          serpdigger.runner.miscellaneous.longestLocationLength = emailsFoundInfo[0].LOCATION.length;
        }
        if (serpdigger.paid && downloaded && downloadedAs === "PARTIAL")
          serpdigger.runner.current.partialDownloadInfo.emailsAdded = ++partialDownloadInfo.emailsAdded || 1;
        isNewEmailsAdded = true;
      }
    });
    if (isNewEmailsAdded && popup)
      try {
        if (serpdigger.runner.miscellaneous.isTableContentVisible) popup.updateTable();
        popup.updateEmailsFoundControls(emailsFoundInfo.length, emailsFoundInfo.length ? "text-success" : "text-muted", true);
        popup.updateCollectedEmailsSubtext(`unique email${emailsFoundInfo.length > 1 ? "s" : ""}`);
        if (emailsFoundInfo.length > 0) {
          if (serpdigger.paid) {
            popup.updatePartialDownloadButtonBadge();
            if (serpdigger.runner.miscellaneous.canUpdateUIMessage && !deepSearchInfo.running && !popup.isBuyNowButtonVisible()) {
              popup.showRealtimePreviewTip();
              serpdigger.runner.miscellaneous.canUpdateUIMessage = false;
            }
          }
          // Keeps updating download button till it gets enabled
          // (on trial till emails are equal or greater than 10, otherwise greater than 1)
          if (!popup.isDownloadButtonEnabled()) popup.updateDownloadButton();
        }
      } catch (error) {
        log.e("popup", error.message);
      }
  } else if (request.eventName === "runner:paused") {
    // Process paused for partial download
    log.i("runtime.onMessage", queryInfo.currentIndex);
    serpdigger.runner.miscellaneous.lastSearchResultsPage = request.eventData.lastPage;
    chrome.tabs.query({ active: true }, tabs => {
      const [updatedTab] = tabs;
      if (updatedTab.url !== defaultIntervalSite) chrome.tabs.update(tab.id, { url: defaultIntervalSite });
      else onTabUpdate(tab.id, { status: "complete" }, updatedTab);
    });
  } else if (request.eventName === "runner:resume") {
    // Resume process after partial download
    log.i("runtime.onMessage", queryInfo.currentIndex);
    serpdigger.runner.current.partialDownloadInfo.running = false;
    onTabUpdate(tab.id, { status: "resuming" }, tab);
  } else if (request.eventName === "runner:jumpToNextRunner") {
    // Will jump to the next runner as the current page results doesn't have pagination
    log.i("runtime.onMessage", queryInfo.currentIndex);
  } else if (request.eventName === "runner:pageIterationCancelled") {
    // Page iteration cancelled due to deep search was unchecked during deep search preparing/running
    log.i("runtime.onMessage", queryInfo.currentIndex);
    onResponse({
      eventName: "runner:finish",
      eventData: { hasResults: searchHasResults, pageIterationCancelled: true }
    });
  } else if (request.eventName === "runner:finish") {
    log.i("runtime.onMessage", queryInfo.currentIndex);
    if (deepSearchInfo.running || request.eventData.pageIterationCancelled) {
      serpdigger.runner.current.deepSearchHasResults = request.eventData.hasResults;
      serpdigger.runner.current.emailsToExclude = []; // Resets emails to exclude
    } else {
      serpdigger.runner.current.searchHasResults = request.eventData.hasResults;
      serpdigger.runner.current.deepSearchHasResults = false;
    }
    _onRunnerIsDeepSearchGoingToRun(serpdigger.runner.current.searchHasResults);
    ({ searchHasResults, deepSearchHasResults } = serpdigger.runner.current);
    // Sets the delay:
    // Offsetted user defined delay / 1.5 seconds delay whether deep search is about to start / 1 second delay if there's no any results at all
    // eslint-disable-next-line no-nested-ternary
    const delay = !deepSearchInfo.running && searchHasResults ? getDelay() : deepSearchInfo.running && searchHasResults ? 1500 : 1000;
    if (!deepSearchInfo.enabled || (deepSearchInfo.enabled && !deepSearchInfo.running))
      if (queryInfo.currentIndex + 1 >= allQueries.length) {
        _onRunnerFinish();
        return;
      }
    if (!deepSearchInfo.running) {
      _onRunnerPrepareNextQueryInfo();
      setNextRunnerTimeOut(delay);
    } else {
      _onRunnerPrepareDeepSearchQueryInfo();
      setTimeout(_nextRunner, delay);
    }
    if (!deepSearchInfo.running) serpdigger.runner.current.queryInfo.currentIndex += 1;
    else if (request.eventName === "download") serpdigger.download();
  } else if (request.eventName === "runner:checkInternetConnection") {
    // Checks the internet connection whether google results hasn't loaded properly
    serpdigger.runner.miscellaneous.lastSearchResultsPage = request.eventData.lastPage;
    if (popup)
      try {
        popup.checkInternetConnection();
      } catch (error) {
        log.e(error);
      }
    else {
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
      Offline.check();
      Offline.on("down", () => {
        log.w("Internet gone!");
        Offline.on("up", () => {
          log.i("Internet back!");
          serpdigger.runner.miscellaneous.pendingResumeAfterInternetBack = true;
          chrome.tabs.reload(tab.id);
        });
      });
    }
  }
}

async function cancelNextRunner() {
  const { nextRunnerInterval } = serpdigger.runner.current;
  if (nextRunnerInterval === undefined) return;
  clearInterval(nextRunnerInterval);
  serpdigger.runner.current.nextRunnerInterval = undefined;
}

async function setNextRunnerTimeOut(delay, updatedDelay = false) {
  const { waiting, partialDownloadInfo, nextRunnerInterval } = serpdigger.runner.current;
  let { delayInputEmptied } = serpdigger.runner.miscellaneous;
  chrome.tabs.query({ active: true }, tabs => {
    const [updatedTab] = tabs;
    const [popup] = chrome.extension.getViews({ type: "popup" });
    if (partialDownloadInfo.preparing || partialDownloadInfo.running) return;
    if (popup && serpdigger.runner.miscellaneous.isDomElementsLoaded && !updatedDelay && updatedTab.url === defaultIntervalSite)
      try {
        serpdigger.runner.miscellaneous.delayInputEmptied = popup.isDelayInputEmpty();
        ({ delayInputEmptied } = serpdigger.runner.miscellaneous);
        popup.redFocusDelayInput(delayInputEmptied);
        popup.updateDownloadButton();
      } catch (error) {
        log.e("popup", error.message);
      }
    if (delayInputEmptied || updatedDelay)
      DJM._Run("emptiedDelayInput", { response: !delayInputEmptied ? "delaySet" : undefined }).then(result =>
        setBackgroundDJMResult(result)
      );
    if (delayInputEmptied || (updatedDelay && !waiting)) return;
    clearInterval(nextRunnerInterval);
    serpdigger.runner.current.nextRunnerInterval = setInterval(_nextRunner, delay);
  });
}

function onTabUpdate(tabId, changeInfo, tab) {
  const { url } = tab;
  const { running, currentQueryDelay, queryInfo, allQueries, queries } = serpdigger.runner.current;
  const { deepSearchInfo, emailsFoundInfo, partialDownloadInfo } = serpdigger.runner.current;
  let { waiting } = serpdigger.runner.current;
  const { defaultQueryRunningStatus, defaultDeepSearchStatus } = serpdigger.runner.defaults;
  const { lastSearchResultsPage } = serpdigger.runner.miscellaneous;
  const { lastDJMIntervalSiteResult, pendingResumeAfterInternetBack } = serpdigger.runner.miscellaneous;
  let { uiMessageOnDelayTurn } = serpdigger.runner.miscellaneous;
  let [popup] = chrome.extension.getViews({ type: "popup" });
  if (!serpdigger.runner.miscellaneous.isDomElementsLoaded) popup = undefined;
  if (popup && changeInfo.status === "loading")
    try {
      popup.checkInternetConnection();
    } catch (error) {
      log.e(error);
    }
  const pageReloadedWhileWaiting = waiting && tab.url === defaultIntervalSite && !partialDownloadInfo.preparing;
  if (pageReloadedWhileWaiting && changeInfo.status === "complete") setBackgroundDJMResult(lastDJMIntervalSiteResult);
  if (tabId !== serpdigger.runner.current.tab.id || !running || pageReloadedWhileWaiting) return;
  if (changeInfo.status === "complete") serpdigger.runner.miscellaneous.canUpdateUIMessage = true;
  if (pendingResumeAfterInternetBack && changeInfo.status === "complete") {
    chrome.tabs.sendMessage(tab.id, {
      eventName: "resumeOnPage",
      eventData: {
        lastPage: lastSearchResultsPage
      }
    });
    serpdigger.runner.miscellaneous.lastSearchResultsPage = 0;
    serpdigger.runner.miscellaneous.pendingResumeAfterInternetBack = false;
    log.w("internet back");
    return;
  }
  serpdigger.runner.miscellaneous.loadingSite = changeInfo.status === "loading";
  if (partialDownloadInfo.preparing) {
    // Resets partialDownloadInfo.running to cancel any pending resume request whether partial download is requested again
    serpdigger.runner.current.partialDownloadInfo.running = false;
    // Sends the request to navigate to preparing partial download site again whether was interrupted by another url update
    // while partial download was being requested
    if (url !== defaultIntervalSite) onResponse({ eventName: "runner:paused", eventData: { lastPage: lastSearchResultsPage } });
    else if (url !== undefined && url === defaultIntervalSite && changeInfo.status === "complete") {
      serpdigger.runner.current.partialDownloadInfo.preparingHandled = true;
      DJM._Run("partialDownloadRequest", { reset: true })
        .then(result => setBackgroundDJMResult(result))
        .finally(() =>
          setTimeout(() => {
            // When the preparing partial download site is completely loaded continues sending the request to open the file save dialog
            serpdigger.runner.current.partialDownloadInfo.preparing = serpdigger.runner.current.partialDownloadInfo.preparingHandled = false;
            serpdigger.download(true);
          }, 2000)
        );
    }
    return;
  }
  // Prepares resuming from the next page where was paused on partial download request
  if (partialDownloadInfo.running) {
    // Checking for url being different than preparing partial download site ensures to properly detect when to resume
    // when requests are being interrupted by another url update
    if (url !== undefined && url !== defaultIntervalSite && changeInfo.status === "complete") {
      chrome.tabs.sendMessage(tabId, {
        eventName: "resumeOnPage",
        eventData: {
          lastPage: lastSearchResultsPage
        }
      });
      serpdigger.runner.miscellaneous.lastSearchResultsPage = 0;
    }
    return;
  }
  if (url !== undefined && changeInfo.status === "complete") {
    if (!deepSearchInfo.running) serpdigger.runner.current.waiting = url === defaultIntervalSite;
    else if (deepSearchInfo.running) serpdigger.runner.current.deepSearchInfo.preparing = url === defaultPreparingDeepSearchSite;
  }
  ({ waiting } = serpdigger.runner.current);
  setTimeout(() => {
    if (serpdigger.runner.miscellaneous.canUpdateUIMessage && emailsFoundInfo.length > 0) {
      if (url === defaultIntervalSite) {
        if (!deepSearchInfo.enabled && (!uiMessageOnDelayTurn || uiMessageOnDelayTurn === "keyboardNavigation"))
          serpdigger.runner.miscellaneous.uiMessageOnDelayTurn = "deepSearch";
        else if (!uiMessageOnDelayTurn || uiMessageOnDelayTurn === "deepSearch" || uiMessageOnDelayTurn === "keyboardNavigation")
          serpdigger.runner.miscellaneous.uiMessageOnDelayTurn = "hotkey";
        else if (uiMessageOnDelayTurn === "hotkey") serpdigger.runner.miscellaneous.uiMessageOnDelayTurn = "keyboardNavigation";
        ({ uiMessageOnDelayTurn } = serpdigger.runner.miscellaneous);
      }
      if (popup)
        try {
          if (serpdigger.paid && !popup.isBuyNowButtonVisible()) {
            if (url !== defaultIntervalSite) {
              if (!deepSearchInfo.preparing && !deepSearchInfo.running) popup.showRealtimePreviewTip();
              else popup.showDeepSearchInfo();
            } else if (uiMessageOnDelayTurn === "deepSearch") popup.showDeepSearchInfo();
            else if (uiMessageOnDelayTurn === "hotkey") popup.showHotkeyTip();
            else if (uiMessageOnDelayTurn === "keyboardNavigation") popup.showKeyboardNavigationTip();
          }
        } catch (error) {
          log.e("popup", error.message);
        }
      serpdigger.runner.miscellaneous.canUpdateUIMessage = false;
      serpdigger.runner.miscellaneous.canForceToggleUIMessage = true;
    }
  }, 0);
  if (waiting) {
    if (popup)
      try {
        popup.updateProgressIndicator();
      } catch (error) {
        log.e("popup", error.message);
      }
    updateWaitingSiteFooter(popup);
  }
  if (waiting || deepSearchInfo.preparing) {
    // Will also be stopped here whether user requested a patial download during delay was running
    // and download or cancel finishes before delay ends (resuming the process later after delay ends)
    return;
  }
  if ((url !== undefined && changeInfo.status === "complete") || changeInfo.status === "resuming") {
    chrome.tabs.sendMessage(tabId, {
      eventName: "run",
      eventData: {
        delay: currentQueryDelay,
        foundEmails: emailsFoundInfo.length,
        queryNumber: queryInfo.currentIndex + 1,
        totalQueries: allQueries.length,
        queryString: allQueries[queryInfo.currentIndex],
        queryObject: queries[queryInfo.currentIndex]
      }
    });
    serpdigger.runner.current.queryInfo.statusString = defaultQueryRunningStatus;
    serpdigger.runner.current.deepSearchInfo.statusString = deepSearchInfo.running ? defaultDeepSearchStatus : "";
    if (popup)
      try {
        popup.updateProgressIndicator();
        popup.updateQueryStatusText(queryInfo.statusString);
        popup.updateTotalNumberOfQueries(allQueries.length);
        popup.updateCurrentQueryNumber(queryInfo.currentIndex + 1);
        popup.updateCurrentQueryText(allQueries[queryInfo.currentIndex]);
        popup.updateDeepSearchStatusText(deepSearchInfo.statusString);
      } catch (error) {
        log.e("popup", error.message);
      }
  }
}

function updateWaitingSiteFooter(popup) {
  if (!popup) serpdigger.runner.miscellaneous.isTableContentVisible = false;
  const { delay, emailsFoundInfo, partialDownloadInfo, deepSearchInfo } = serpdigger.runner.current;
  const { delayInputEmptied, isTableContentVisible } = serpdigger.runner.miscellaneous;
  const { downloaded, downloadedAs } = serpdigger.runner.download;
  const replaceTemplate = {
    onProp: "message",
    replace: [
      { here: "[emails]", to: formatNumber(emailsFoundInfo.length) },
      { here: "[emails-on-badge]", to: partialDownloadInfo.emailsAdded ? formatNumber(partialDownloadInfo.emailsAdded) : 0 },
      {
        here: "[emails-downloaded]",
        to: formatNumber(emailsFoundInfo.length - (partialDownloadInfo.emailsAdded ? partialDownloadInfo.emailsAdded : 0))
      }
    ]
  };
  const excludeTemplate = {
    onProp: "activeOnlyWhen",
    exclude: [
      { match: "emailsAddedRealtimePreviewHidden", active: !(emailsFoundInfo.length > 0 && !isTableContentVisible) || !serpdigger.paid },
      { match: "emailsAddedOnBadge", active: !(partialDownloadInfo.emailsAdded > 0) },
      { match: "emailsAddedRealtimePreviewVisible", active: !(emailsFoundInfo.length > 0 && isTableContentVisible) },
      { match: "partialDownloaded", active: !(downloaded && downloadedAs === "PARTIAL") },
      { match: "deepSearchDisabled", active: deepSearchInfo.enabled },
      { match: "delayIsNotTheRecommended", active: !(delay < 45000) }
    ]
  };
  if (delayInputEmptied) DJM._Run("emptiedDelayInput").then(result => setBackgroundDJMResult(result));
  else {
    DJM._Run("duringDelay", { replaceTemplate, excludeTemplate }).then(result => setBackgroundDJMResult(result));
  }
}

function _nextRunner(resuming = false) {
  const { stopped, allQueries, searchHasResults, emailsToExclude, nextRunnerInterval } = serpdigger.runner.current;
  const { queryInfo, deepSearchInfo, partialDownloadInfo } = serpdigger.runner.current;
  clearInterval(nextRunnerInterval);
  serpdigger.runner.current.nextRunnerInterval = undefined;
  // Resuming flag is set to true whether is being called after partial download request for resume
  if (!resuming) {
    // Immediately cancels deep search whether was being prepared and deep search was turned off
    if (deepSearchInfo.preparing && !deepSearchInfo.enabled) {
      serpdigger.runner.current.deepSearchInfo.preparing = false;
      onResponse({
        eventName: "runner:finish",
        eventData: { hasResults: searchHasResults }
      });
      return;
    }
    serpdigger.runner.current.waiting = false;
    serpdigger.runner.current.deepSearchInfo.preparing = false;
    // Stops here whether partial download is preparing and is on delay or whether is running and delay has ended
    if (partialDownloadInfo.preparingHandled || partialDownloadInfo.running) return;
    log.i("_nextRunner()", queryInfo.currentIndex, allQueries.length);
    if (stopped) return;
  }
  chrome.storage.local.get("cse", items => {
    let url = items.cse;
    const deepSearchTerms = deepSearchInfo.running ? ` +-${emailsToExclude.join("+-").replace(REMOVE_EMAIL_FORMAT_REGEXP, "")}` : "";
    if (!url) return;
    url += `&q=${encodeURIComponent(allQueries[queryInfo.currentIndex])}${deepSearchTerms}&ia=web`;
    // Ensures to not continue whether partial download is preparing and stills waiting on delay
    if (serpdigger.runner.current.partialDownloadInfo.preparingHandled) return;
    chrome.tabs.update(serpdigger.runner.current.tab.id, { url });
    log.i("_nextRunner()", url);
  });
}

function _onRunnerStopped() {
  log.i("_onRunnerStopped()");
  const { tab } = serpdigger.runner.current;
  chrome.tabs.sendMessage(tab.id, {
    eventName: "stopped"
  });
  DJM._Run("stopped")
    .then(result => chrome.storage.local.set({ BackgroundDJMResult_ApplyOnLoad: result }))
    .finally(() => {
      chrome.storage.local.remove(["BackgroundDJMResult"]);
      chrome.tabs.update(tab.id, {
        url: defaultStoppedSite
      });
      serpdigger.runner.current.tab = null;
    });
  serpdigger.runner.current.stopped = true;
  serpdigger.runner.current.running = false;
  serpdigger.runner.current.complete = false;
  serpdigger.runner.current.waiting = false;
  const { defaultQueryStoppedStatus } = serpdigger.runner.defaults;
  serpdigger.runner.current.queryInfo.statusString = defaultQueryStoppedStatus;
  const { queryInfo } = serpdigger.runner.current;
  const [popup] = chrome.extension.getViews({ type: "popup" });
  if (popup)
    setTimeout(() => {
      try {
        popup.updateTable({});
        popup.updateButtons();
        popup.disableInputs(false);
        popup.updateProgressIndicator();
        popup.updateQueryStatusText(queryInfo.statusString);
        popup.hideHotkeyTip();
        popup.hideKeyboardNavigationTip();
        popup.hideKeyboardNavigationCtrlTip();
        popup.hideRealtimePreviewTip();
        popup.hideDeepSearchInfo();
        popup.hideProgressStatusIndicator();
        popup.showProcessStatusIndicator();
        popup.updateProcessStatusIndicatorText("STOPPED", "text-danger");
        popup.updateUserFriendlyStatusText(false);
        popup.updateUserFriendlyStatusArrow();
        if (serpdigger.paid) popup.showUserFriendlyStatus();
        popup.showCompleteOnPreviewModal();
      } catch (error) {
        log.e("popup", error.message);
      }
    }, 0);
  chrome.runtime.onMessage.removeListener(onResponse);
  chrome.tabs.onUpdated.removeListener(onTabUpdate);
}

function _onRunnerFinish() {
  chrome.tabs.update(serpdigger.runner.current.tab.id, {
    url: defaultFinishedSite
  });
  serpdigger.runner.current.running = false;
  serpdigger.runner.current.complete = true;
  serpdigger.runner.current.waiting = false;
  const { emailsFoundInfo } = serpdigger.runner.current;
  const [popup] = chrome.extension.getViews({ type: "popup" });
  if (popup)
    try {
      popup.hideDialogs();
      popup.disableInputs(false);
      popup.updateQueryStatusText("");
      popup.updateProgressIndicator();
      popup.updateButtons();
      popup.updatePartialDownloadButton();
      if (!popup.isPreviewModalVisible()) {
        popup.updateTable({});
        popup.hideCurrentQueryContent();
      }
      popup.hideHotkeyTip();
      popup.hideKeyboardNavigationTip();
      popup.hideKeyboardNavigationCtrlTip();
      popup.hideRealtimePreviewTip();
      popup.hideDeepSearchInfo();
      popup.hideProgressStatusIndicator();
      popup.showProcessStatusIndicator();
      popup.updateProcessStatusIndicatorText("COMPLETED", emailsFoundInfo.length > 0 ? "text-success" : "text-muted");
      popup.updateUserFriendlyStatusText();
      popup.updateUserFriendlyStatusArrow();
      if (serpdigger.paid) popup.showUserFriendlyStatus();
      popup.showCompleteOnPreviewModal();
    } catch (error) {
      log.e("popup", error.message);
    }
  else
    chrome.notifications.clear(chrome.runtime.id, () =>
      chrome.notifications.create(
        chrome.runtime.id,
        {
          type: "basic",
          title: "Serpdigger",
          message: "Complete! - Tip: Press Ctrl+Shift+S on your browser",
          iconUrl: "../logo/logo-48.png"
        },
        () =>
          setTimeout(() => {
            chrome.notifications.clear(chrome.runtime.id, () => {});
          }, 3500)
      )
    );
  chrome.runtime.onMessage.removeListener(onResponse);
  chrome.tabs.onUpdated.removeListener(onTabUpdate);
  serpdigger.runner.current.tab = null;
}

function _onRunnerIsDeepSearchGoingToRun(searchHasResults) {
  const { deepSearchInfo } = serpdigger.runner.current;
  // Skips deep search whether is about to start and any results where found on normal search
  serpdigger.runner.current.deepSearchInfo.running = searchHasResults ? deepSearchInfo.enabled && !deepSearchInfo.running : false;
}

function _onRunnerPrepareNextQueryInfo(resuming = false) {
  const { defaultQueryWaitingStatus } = serpdigger.runner.defaults;
  serpdigger.runner.current.queryInfo.statusString = defaultQueryWaitingStatus;
  serpdigger.runner.current.deepSearchInfo.statusString = "";
  const { tab, searchHasResults, queryInfo, allQueries, deepSearchInfo } = serpdigger.runner.current;
  const [popup] = chrome.extension.getViews({ type: "popup" });
  if (popup && serpdigger.runner.miscellaneous.isDomElementsLoaded)
    try {
      popup.updateProgressIndicator();
      popup.updateQueryStatusText(queryInfo.statusString);
      popup.updateCurrentQueryText(allQueries[!resuming ? queryInfo.currentIndex + 1 : queryInfo.currentIndex]);
      popup.updateDeepSearchStatusText(deepSearchInfo.statusString);
    } catch (error) {
      log.e("popup", error.message);
    }
  if (resuming) return;
  chrome.tabs.update(tab.id, {
    url: !searchHasResults ? "about:blank" : defaultIntervalSite
  });
}

function _onRunnerPrepareDeepSearchQueryInfo() {
  const { defaultQueryPreparingStatus, defaultDeepSearchStatus } = serpdigger.runner.defaults;
  serpdigger.runner.current.queryInfo.statusString = defaultQueryPreparingStatus;
  const { tab, queryInfo } = serpdigger.runner.current;
  const [popup] = chrome.extension.getViews({ type: "popup" });
  if (popup && serpdigger.runner.miscellaneous.isDomElementsLoaded)
    try {
      popup.updateProgressIndicator();
      popup.updateQueryStatusText(queryInfo.statusString);
      popup.updateDeepSearchStatusText(defaultDeepSearchStatus);
    } catch (error) {
      log.e("popup", error.message);
    }
  chrome.tabs.update(tab.id, { url: defaultPreparingDeepSearchSite });
}

function _onRunnerPause() {
  chrome.tabs.sendMessage(serpdigger.runner.current.tab.id, {
    eventName: "pause"
  });
}

serpdigger.run = queries => {
  log.i("run", queries);
  chrome.runtime.onMessage.addListener(onResponse);
  chrome.tabs.onUpdated.addListener(onTabUpdate);
  const { defaultQueryRunningStatus } = serpdigger.runner.defaults;
  serpdigger.runner.current.running = true;
  serpdigger.runner.current.complete = false;
  serpdigger.runner.current.stopped = false;
  serpdigger.runner.current.waiting = false;
  serpdigger.runner.current.queryInfo = {};
  serpdigger.runner.current.queryInfo.currentIndex = 0;
  serpdigger.runner.current.queryInfo.statusString = defaultQueryRunningStatus;
  serpdigger.runner.current.allQueries = queries.str;
  serpdigger.runner.current.queries = queries.obj;
  serpdigger.runner.current.emailsFoundInfo = [];
  serpdigger.runner.current.emailsToExclude = [];
  serpdigger.runner.current.partialDownloadInfo = {};
  serpdigger.runner.current.deepSearchInfo = {};
  serpdigger.runner.current.searchHasResults = false;
  serpdigger.runner.current.deepSearchHasResults = false;
  serpdigger.runner.miscellaneous.loadingSite = false;
  serpdigger.runner.miscellaneous.longestEmailLength = 0;
  serpdigger.runner.miscellaneous.longestKeywordLength = 0;
  serpdigger.runner.miscellaneous.longestLocationLength = 0;
  serpdigger.runner.miscellaneous.delayInputEmptied = false;
  serpdigger.runner.miscellaneous.lastDJMIntervalSiteResult = {};
  serpdigger.runner.download.saveDialogOpening = false;
  serpdigger.runner.download.saveDialogOpened = false;
  serpdigger.runner.download.downloadId = 0;
  serpdigger.runner.download.downloaded = false;
  serpdigger.runner.download.downloadedAs = "";
  setTimeout(() => {
    chrome.storage.local.remove(["BackgroundDJMResult"]);
    chrome.storage.local.remove(["BackgroundDJMResult_ApplyOnLoad"]);
    chrome.storage.local.remove(["PendingRefreshAfterInternetGone"]);
  }, 0);
  restoreDeepSearchState();
  const { defaultDeepSearchStatus } = serpdigger.runner.defaults;
  const { deepSearchInfo, queryInfo, allQueries } = serpdigger.runner.current;
  const [popup] = chrome.extension.getViews({ type: "popup" });
  log.i("run", !!popup);
  if (popup)
    try {
      popup.redFocusDelayInput(false);
      popup.cancelDownloadButtonPulsate();
      serpdigger.runner.current.deepSearchInfo.statusString = deepSearchInfo.running ? defaultDeepSearchStatus : "";
      popup.disableInputs(true);
      popup.updateEmailsFoundControls(0, "text-muted");
      popup.updateCurrentQueryNumber(1);
      popup.updateTotalNumberOfQueries(allQueries.length);
      popup.updateQueryStatusText(queryInfo.statusString);
      popup.updateCurrentQueryText(allQueries[0]);
      popup.updateDeepSearchStatusText(deepSearchInfo.statusString);
      popup.updateCollectedEmailsSubtext("unique emails");
      popup.hideUserFriendlyStatus();
      popup.updateButtons();
      setTimeout(() => popup.showCurrentQueryContent(), 0);
      setTimeout(() => popup.showCollectedEmailsCounter(), 0);
      setTimeout(() => popup.showProgressIndicator(), 0);
      setTimeout(() => popup.showProgressStatusIndicator(), 0);
      popup.buildTable();
    } catch (error) {
      log.e("popup", error.message);
    }
  chrome.tabs.query({ active: true }, tabs => {
    const [tabsFirstIndex] = tabs;
    serpdigger.runner.current.tab = tabsFirstIndex;
    _nextRunner();
  });
};

function getDelay() {
  const min = serpdigger.runner.current.delay - 1000;
  const max = serpdigger.runner.current.delay + 1000;
  return Math.floor(Math.random() * (+max - +min)) + +min;
}

serpdigger.stop = () => _onRunnerStopped();

const s2abWorker = new Worker(
  URL.createObjectURL(
    new Blob(
      [
        `onmessage=${e => {
          const s = e.data;
          const buf = new ArrayBuffer(s.length);
          const view = new Uint8Array(buf);
          // eslint-disable-next-line no-bitwise
          for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
          postMessage(buf);
        }}`
      ],
      { type: "application/javascript" }
    )
  )
);

serpdigger.download = (readyForPartialDownload = false) => {
  const { running, stopped, emailsFoundInfo, deepSearchInfo } = serpdigger.runner.current;
  let { waiting } = serpdigger.runner.current;
  const { longestEmailLength, longestKeywordLength, longestLocationLength } = serpdigger.runner.miscellaneous;
  const { defaultQueryPausedStatus, defaultQueryResumingStatus } = serpdigger.runner.defaults;
  const { saveDialogOpening, saveDialogOpened } = serpdigger.runner.download;
  if (saveDialogOpening || saveDialogOpened) return;
  let [popup] = chrome.extension.getViews({ type: "popup" });
  let isSearching = !waiting && !deepSearchInfo.preparing;
  const isPartialDownload = running && serpdigger.paid;
  if (popup)
    try {
      popup.cancelDownloadButtonPulsate();
      popup.removeDownloadButtonPulsate();
    } catch (error) {
      log.e("popup", error.message);
    }
  if (!readyForPartialDownload) {
    serpdigger.runner.current.partialDownloadInfo.preparing = isPartialDownload;
    if (serpdigger.runner.current.partialDownloadInfo.preparing) {
      isSearching = !waiting && !deepSearchInfo.preparing;
      if (popup) {
        setTimeout(() => {
          try {
            popup.hidePartialDownloadBadge();
            popup.updateProgressIndicator();
            popup.updatePartialDownloadButton();
            popup.updateDownloadButton();
          } catch (error) {
            log.e("popup", error.message);
          }
        }, 0);
        if (!waiting) popup.updateQueryStatusText(defaultQueryPausedStatus);
      }
      if (isSearching) {
        // Sends request for pausing the process
        _onRunnerPause();
      } else {
        // Immediately continues whether was not searching
        onResponse({
          eventName: "runner:paused",
          eventData: { lastPage: 0 }
        });
      }
      return;
    }
  } else
    DJM._Run("partialDownloadRequest")
      .then(result => setBackgroundDJMResult(result))
      .finally(() => {
        serpdigger.runner.current.partialDownloadInfo.running = serpdigger.runner.download.saveDialogOpening = true;
        if (popup)
          try {
            popup.updatePartialDownloadButtonText("DOWNLOADING...");
            popup.updateDownloadButtonText("DOWNLOADING...");
          } catch (error) {
            log.e("popup", error.message);
          }
      });
  const date = new Date();
  const dateString = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
  const timeString = `${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  let emails = emailsFoundInfo;
  emails = serpdigger.paid ? emails : emails.slice(0, 10);
  const formattedEmailsFound = formatNumber(emails.length);
  setTimeout(() => {
    try {
      /* Creates a new blank workbook */
      const wb = XLSX.utils.book_new();
      /* Takes the array of objects and returns a worksheet */
      const ws = XLSX.utils.json_to_sheet(emails);
      /* Defines the worksheet name */
      const wsName = `Serpdigger (${isPartialDownload ? "Partial Download" : `Process ${stopped ? "Stopped" : "Completed"}`})`;
      /* Sets worksheet columns width */
      const emailColLength = longestEmailLength > "EMAIL".length ? longestEmailLength : "EMAIL".length + 1;
      const KeywordColLength = longestKeywordLength > "KEYWORD".length ? longestKeywordLength : "KEYWORD".length + 1;
      const LocationColLength = longestLocationLength > "LOCATION".length ? longestLocationLength : "LOCATION".length + 1;
      const wscols = [{ wch: emailColLength }, { wch: KeywordColLength }, { wch: LocationColLength }];
      ws["!cols"] = wscols;
      /* Adds the worksheet to the workbook */
      XLSX.utils.book_append_sheet(wb, ws, wsName);
      /* Sets properties to workbook */
      const credits = "Serpdigger (Developed by Yossi Bezalel / Improved by Yossi Bezalel)";
      wb.Props = {
        Title: "Serpdigger - The World’s First Elastic Scraper",
        // eslint-disable-next-line no-nested-ternary
        Category: `${isPartialDownload ? "Partial Download" : `Process ${stopped ? "Stopped" : "Completed"}`}`,
        Keywords: `${formattedEmailsFound} collected email${formattedEmailsFound === 1 ? "" : "s"}`,
        Company: "ROI.IM",
        Author: credits,
        Comments: credits
      };
      /* Generates array buffer */
      const wbout = XLSX.write(wb, { type: "binary", bookType: "xlsx" });
      /* Converts data to binary string */
      s2abWorker.postMessage(wbout);
      s2abWorker.onmessage = e => {
        /* Creates data URL */
        const url = URL.createObjectURL(new Blob([e.data], { type: "application/octet-stream" }));
        /* Triggers download with chrome API */
        chrome.downloads.download({ url, filename: `serpdigger_${dateString}_${timeString}.xlsx`, saveAs: true }, downloadId => {
          serpdigger.runner.download.downloadId = downloadId;
          serpdigger.runner.download.saveDialogOpening = !(serpdigger.runner.download.saveDialogOpened = true);
        });
      };
      s2abWorker.onerror(e => {
        throw new Error(e);
      });
    } catch (error) {
      log.e("XLSX", error.message);
    }
  }, 0);
  chrome.downloads.onChanged.addListener(function onDownload(downloadDelta) {
    if (downloadDelta.id !== serpdigger.runner.download.downloadId || !downloadDelta.state) return;
    if (downloadDelta.state.current) {
      if (running)
        DJM._Run("partialDownloadRequest", { response: downloadDelta.state.current }).then(result => setBackgroundDJMResult(result));
      setTimeout(() => {
        if (popup)
          try {
            if (downloadDelta.state.current !== "complete") popup.addDownloadButtonPulsate(!isPartialDownload ? 0 : undefined);
          } catch (error) {
            log.e("popup", error.message);
          }
        if (isPartialDownload) resumeProcess();
      }, 1000);
      if (downloadDelta.state.current === "complete") {
        serpdigger.runner.download.downloaded = true;
        // eslint-disable-next-line no-nested-ternary
        serpdigger.runner.download.downloadedAs = !serpdigger.paid ? "TRIAL" : isPartialDownload ? "PARTIAL" : "PAID";
        serpdigger.runner.current.partialDownloadInfo.emailsAdded = 0;
      }
      serpdigger.runner.download.saveDialogOpened = false;
    }
    function resumeProcess() {
      if (readyForPartialDownload) {
        [popup] = chrome.extension.getViews({ type: "popup" });
        if (popup)
          try {
            popup.updateQueryStatusText(defaultQueryResumingStatus);
          } catch (error) {
            log.e("popup", error.message);
          }
        ({ waiting } = serpdigger.runner.current);
        if (waiting)
          setTimeout(() => {
            // Go back to waiting site whether was on delay before partial download request and stills on delay
            _onRunnerPrepareNextQueryInfo(true);
            DJM._Run("partialDownloadRequest", { response: "waiting" })
              .then(result => setBackgroundDJMResult(result))
              .finally(() => {
                serpdigger.runner.current.partialDownloadInfo.running = false;
              });
          }, 1000);
        else {
          // Go back to previous search results whether was searching before partial download request
          // or whether user requested the patial download during delay was running and download or
          // cancel finished after delay ended
          _nextRunner(true);
        }
      }
      if (popup)
        try {
          popup.updatePartialDownloadButton();
          popup.updateDownloadButton();
        } catch (error) {
          log.e("popup", error.message);
        }
    }
    chrome.downloads.onChanged.removeListener(onDownload);
  });
};
