/* eslint-disable func-names */
(() => {
  log = new Log("duckduckgo");
  const URL_REGEXP = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
  let canRequestInternetCheck = true;
  let runner;

  function Runner(options) {
    log.i("Runner/init");
    this.options = options;
    this.currentPage = 0;
    this.lastPage = 0;
    this.urls = [];
    this.stopped = true;
    this.pausePending = false;
    this.resumePending = false;
    this.cancelDeepSearchPending = false;
  }

  Runner.prototype.setOptions = function (options) {
    log.i("Runner/setOptions", options);
    this.options = options;
  };

  Runner.prototype.run = function (callback) {
    log.i("Runner/run", callback);
    this.stopped = false;
    this.start(callback);
  };

  Runner.prototype.start = function (originalCallback) {
    log.i("Runner/start");
    const _runner = this;
    const isNoResults = $(".gsc-result .gs-no-results-result").size() > 0;
    callback = function (finished) {
      if (_runner.stopped || _runner.pausePending) {
        log.i(_runner.stopped ? "Stopped" : "Paused");
        if (_runner.pausePending) {
          _runner.pausePending = false;
          _runner._paused();
        }
      } else if (_runner.cancelDeepSearchPending) {
        _runner.cancelDeepSearchPending = false;
        _runner._pageIterationCancelled();
        callback(false);
      } else if (finished) {
        log.i(isNoResults ? "No results" : "Finished");
        _runner._finish(!isNoResults);
        if (originalCallback) originalCallback.apply(...args);
      } else helper(callback);
    };

    if (_runner.resumePending) {
      log.i("Resumed");
      _runner.resumePending = false;
    }

    function nextPage(callback) {
      log.i("Runner/start/nextPage");
      if (_runner.stopped || _runner.pausePending) {
        log.i(_runner.stopped ? "Stopped" : "Paused");
        if (_runner.pausePending) {
          _runner.pausePending = false;
          _runner._paused();
        }
        return;
      }

      if (_runner.cancelDeepSearchPending) {
        _runner.cancelDeepSearchPending = false;
        _runner._pageIterationCancelled();
        callback(false);
        return;
      }

      if ($(".gsc-webResult").hasClass("gsc-loading-resultsRoot")) {
        if (canRequestInternetCheck) {
          log.w("Runner/start/nextPage/results not loaded on time - checking internet [1]");
          _runner._checkInternetConnection();
          canRequestInternetCheck = false;
        }
        // Does a callback whether google results hasn't loaded properly, showing a white overlay on results list
        // (this may occur mostly on slow connections)
        callback(false);
        return;
      }

      let currentPage = $(".gsc-cursor .gsc-cursor-page.gsc-cursor-current-page");
      if (currentPage.text().length > 0) _runner.currentPage = +currentPage.text();
      if (currentPage.is(":last-child")) {
        log.i("Runner/start/nextPage/last page", currentPage.text());
        _runner._update();
        _runner._finish(!isNoResults);
      } else if (currentPage.text().length > 0) {
        // Page results have pagination
        log.i("Runner/start/nextPage/next page", currentPage.text(), currentPage.next().text());
        _runner._update();
        let newPageLoadingInterval = setInterval(() => {
          if (!$(".gsc-webResult").hasClass("gsc-loading-resultsRoot")) {
            clearInterval(newPageLoadingInterval);
            canRequestInternetCheck = true;
            if (typeof chrome.app.isInstalled !== "undefined") chrome.storage.local.remove(["PendingRefreshAfterInternetGone"]);
            currentPage.next().click();
            newPageLoadingInterval = setInterval(() => {
              // Reevaluate whether page has results
              currentPage = $(".gsc-cursor .gsc-cursor-page.gsc-cursor-current-page");
              if (!$(".gsc-webResult").hasClass("gsc-loading-resultsRoot")) {
                canRequestInternetCheck = true;
                if (typeof chrome.app.isInstalled !== "undefined") chrome.storage.local.remove(["PendingRefreshAfterInternetGone"]);
                clearInterval(newPageLoadingInterval);
                if (_runner.cancelDeepSearchPending) {
                  _runner.cancelDeepSearchPending = false;
                  _runner._pageIterationCancelled();
                }
                const isLastPageWithoutPagination = currentPage.text().length === 0;
                callback(isLastPageWithoutPagination || _runner.cancelDeepSearchPending);
              } else if (canRequestInternetCheck) {
                log.w("Runner/start/nextPage/results not loaded on time - checking internet [3]");
                _runner._checkInternetConnection();
                canRequestInternetCheck = false;
              }
            }, 1000);
          } else if (canRequestInternetCheck) {
            log.w("Runner/start/nextPage/results not loaded on time - checking internet [2]");
            _runner._checkInternetConnection();
            canRequestInternetCheck = false;
          }
        }, 1000);
      } else {
        // Page results doesn't have pagination
        log.i("Runner/start/nextPage/next runner/no pagination");
        _runner._update();
        _runner._jumpToNextRunner();
        callback(true);
      }
    }

    function helper(callback) {
      log.i("Runner/start/helper");

      function smothScrollToBottom() {
        $("html,body").animate({
          scrollTop: document.body.scrollHeight
        }, 150);
      }
      if (runner.stopped || runner.paused) return;
      let timeout = runner.urls.length * 1.25;
      if (timeout < 1500) timeout = 1500;
      setTimeout(() => {
        // Disable auto-scroll whether tab is in background
        if (!document.hidden) {
          log.i("Runner/start/helper/scroll");
          setTimeout(() => {
            smothScrollToBottom();
          }, 0);
        }
        _runner.extract();
        nextPage(finished => {
          log.i("Runner/start/helper/nextPage", finished);
          // Saves the last page from where urls were extracted
          runner.lastPage = runner.currentPage;
          callback(finished);
        });
      }, timeout);
    }
    helper(callback);
  };

  Runner.prototype.extract = function () {
    log.i("Runner/extract", runner);
    $(".gsc-result").each(function(){
      runner.urls[runner.urls.length] = $(this).find(".gsc-url-top > .gs-visibleUrl-long").text();
    });
  };

  Runner.prototype._start = function () {
    log.i("Runner/_start");
  };

  Runner.prototype.stop = function () {
    log.i("Runner/stop");
    this.stopped = true;
  };

  Runner.prototype.pause = function () {
    log.i("Runner/pause");
    this.pausePending = true;
  };

  Runner.prototype.resumeOnPage = function (eventData) {
    log.i("Runner/resume");
    this.lastPage = eventData.lastPage;
    // Resumes from the next page where was paused before (after extracting urls)
    if (this.lastPage > 0) {
      if ($(".gsc-cursor .gsc-cursor-page")) {
        log.i(`Runner/resuming from page ${this.lastPage + 1}`);
        $(".gsc-cursor .gsc-cursor-page")[this.lastPage].click();
      }
    }
    this.resumePending = true;
    runner._resume();
  };

  Runner.prototype.cancelDeepSearch = function () {
    log.i("Runner/cancel deep search");
    this.cancelDeepSearchPending = true;
  };

  Runner.prototype._finish = function (hasResults) {
    log.i("Runner/_finish", runner.urls);
    chrome.runtime.sendMessage({
      eventName: "runner:finish",
      eventData: {
        hasResults
      }
    });
  };

  Runner.prototype._update = function () {
    log.i("Runner/_update", runner.urls.length);
    chrome.runtime.sendMessage({
      eventName: "runner:update",
      eventData: {
        urls: runner.urls
      }
    });
  };

  Runner.prototype._paused = function () {
    log.i("Runner/_paused");
    chrome.runtime.sendMessage({
      eventName: "runner:paused",
      eventData: {
        lastPage: runner.lastPage
      }
    });
  };

  Runner.prototype._resume = function () {
    log.i("Runner/_resume");
    chrome.runtime.sendMessage({
      eventName: "runner:resume"
    });
  };

  Runner.prototype._jumpToNextRunner = function () {
    log.i("Runner/_jumpToNextRunner");
    chrome.runtime.sendMessage({
      eventName: "runner:jumpToNextRunner"
    });
  };

  Runner.prototype._pageIterationCancelled = function () {
    log.i("Runner/_pageIterationCancelled");
    chrome.runtime.sendMessage({
      eventName: "runner:pageIterationCancelled"
    });
  };

  Runner.prototype._checkInternetConnection = function () {
    log.w("Runner/_checkInternetConnection");
    chrome.runtime.sendMessage({
      eventName: "runner:checkInternetConnection",
      eventData: {
        lastPage: runner.lastPage
      }
    });
  };

  runner = runner || new Runner();

  chrome.runtime.onMessage.addListener((request, sender) => {
    log.i("runtime.onMessage", request, sender);
    if (request.eventName === "run") {
      runner.setOptions(request.eventData);
      runner.run();
    } else if (request.eventName === "cancelDeepSearch") {
      runner.cancelDeepSearch();
    } else if (request.eventName === "pause") {
      runner.pause();
    } else if (request.eventName === "resumeOnPage") {
      runner.resumeOnPage(request.eventData);
    } else if (request.eventName === "stopped") {
      runner.stop();
    }
    return true;
  });
})();