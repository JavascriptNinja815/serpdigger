log = new Log("query");
let $login;
let $loginModal;
let $cseAddressInput;
let $keywordInput;
let $patternInput;
let $locationInput;
let $delayInput;
let $queryStatusText;
let $deepSearchStatusText;
let $deepSearchInfo;
let $progressIndicator;
let $progressIndicatorWrapper;
let $currentQuery;
let $currentQueryText;
let $collectedEmails;
let $collectedEmailsSubtext;
let $collectedEmailsCounter;
let $runnerStatusQuery;
let $progressRunning;
let $runnerStatusIndicator;
let $runnerStatusText;
let $hotkeyTip;
let $keyboardNavigationTip;
let $keyboardNavigationCtrlTip;
let $realtimePreviewTip;
let $userFriendlyStatus;
let $userFriendlyStatusText;
let $userFriendlyStatusArrow;
let $totalQueries;
let $buyNowButton;
let $toggle;
let $help;
let $previewModal;
let $previewDownload;
let $partialDownload;
let $partialDownloadBadge;
let $hiddenTableContent;
let $loader;
let $tableFooter;
let $table;
const backgroundPage = chrome.extension.getBackgroundPage();

function storeCSEAddress(str) {
  chrome.storage.local.set({
    cse: str
  });
}

function storeKeywords(str) {
  chrome.storage.local.set({
    keywords: str
  });
}

function storePatterns(str) {
  chrome.storage.local.set({
    patterns: str
  });
}

function storeLocation(str) {
  chrome.storage.local.set({
    location: str
  });
}

function storeDelay(n) {
  chrome.storage.local.set({
    delay: n
  });
}

function storeIsDeepSearchEnabled(deepSearchEnabled) {
  chrome.storage.local.set({
    deepSearchEnabled
  });
}

function restoreQueryStatusString() {
  log.i("before restore : ", $("#query-status-text").val());
  const { queryInfo, deepSearchInfo } = backgroundPage.serpdigger.runner.current;
  $("#query-status-text").text(queryInfo.statusString + (deepSearchInfo.running ? deepSearchInfo.statusString : ""));
}

function restoreDeepSearchStatusString() {
  log.i("before restore : ", $("#deep-search-status-text").val());
  $("#deep-search-status-text").text(backgroundPage.serpdigger.runner.current.deepSearchInfo.statusString);
}

function restoreDelay() {
  const { delayInputEmptied } = backgroundPage.serpdigger.runner.miscellaneous;
  if (delayInputEmptied) return;
  log.i("before restore : ", $("#delay-input").val());
  chrome.storage.local.get("delay", items => {
    log.i("stored : ", items.delay);
    if (items.delay === undefined || items.delay === null) {
      $("#delay-input").val(10);
      $("#delay-input").change();
      backgroundPage.serpdigger.runner.current.delay = 10000;
    } else {
      $("#delay-input").val(items.delay);
      backgroundPage.serpdigger.runner.current.delay = items.delay * 1000;
    }
  });
}

function restoreIsDeepSearchEnabled() {
  chrome.storage.local.get("deepSearchEnabled", items => {
    if (items.deepSearchEnabled === undefined || items.deepSearchEnabled === null) {
      storeIsDeepSearchEnabled(true);
      $("#deep-search-enabled").get(0).checked = true;
    } else {
      $("#deep-search-enabled").get(0).checked = items.deepSearchEnabled;
    }
  });
}

function restoreKeywordsFromStorage() {
  chrome.storage.local.get("keywords", items => {
    $("#keyword-input").val(items.keywords || "");
  });
}

function restorePatternsFromStorage() {
  chrome.storage.local.get("patterns", items => {
    $("#pattern-input").val(items.patterns || "");
  });
}

function restoreLocationFromStorage() {
  chrome.storage.local.get("location", items => {
    $("#location-input").val(items.location || "");
  });
}

function restoreCSEAddressFromStorage() {
  chrome.storage.local.get("cse", items => {
    $("#cse-address-input").val(items.cse || "");
  });
}

function multilineSplit(str) {
  return str.split(/[\n]+/g);
}

function modifyExactMatch(exactMatch, str) {
  if (!str.trim().length) return "";
  if (exactMatch) {
    if (str.match(/"(.*)"/)) return str;
    return `"${str}"`;
  }
  return str;
}

// Checks for a valid integer
function isValidInteger(num) {
  // eslint-disable-next-line no-bitwise
  if (num === null || `${num}`.trim() === "" || ~~num !== +num) {
    return false; // not an integer
  }
  return true;
}

// Gets the selected text
function getSelectedText() {
  let text = "";
  if (typeof window.getSelection !== typeof undefined) {
    text = window.getSelection().toString();
  } else if (typeof document.selection !== typeof undefined && document.selection.type === "Text") {
    ({ text } = document.selection.createRange());
  }
  return text;
}

const cartesianWorker = new Worker(
  URL.createObjectURL(
    new Blob(
      [
        `onmessage=${e => {
          const args = e.data;
          const r = [];
          const max = args.length - 1;
          function helper(arr, i) {
            for (let j = 0, l = args[i].length; j < l; j += 1) {
              const a = arr.slice(0);
              a[a.length] = args[i][j];
              if (i === max) r[r.length] = a;
              else helper(a, i + 1);
            }
          }
          helper([], 0);
          postMessage(r);
        }}`
      ],
      { type: "application/javascript" }
    )
  )
);

const filterQueriesWorker = new Worker(
  URL.createObjectURL(
    new Blob(
      [
        `onmessage=${e => {
          const queries = e.data.filter(q => q.filter(s => s && s.trim().length).length);
          const queriesStr = queries.map(q => q.filter(s => s && s.trim().length).join(" "));
          postMessage({ queries, queriesStr });
        }}`
      ],
      { type: "application/javascript" }
    )
  )
);

function buildQueries(keywords, location) {
  return new Promise(async resolve => {
    cartesianWorker.postMessage([
      keywords.length ? keywords : [null],
      location.length ? location : [null]
    ]);
    cartesianWorker.onmessage = e => resolve(e.data);
  });
}

function getQueries() {
  return new Promise(async resolve => {
    buildQueries(
      $keywordInput
        .val()
        .split(/[\n]+/g)
        .filter(s => s.trim().length),
      $locationInput
        .val()
        .split(/[\n]+/g)
        .filter(s => s.trim().length),
    ).then(result => {
      filterQueriesWorker.postMessage(result);
      filterQueriesWorker.onmessage = e =>
        resolve({
          str: e.data.queriesStr,
          obj: e.data.queries
        });
    });
  });
}

$(document).ready(() => {
  log.i("before query : ", $("#delay-input").val());

  $("#cse-address-input").on("change keyup", () => {
    storeCSEAddress($cseAddressInput.val());
    if ($cseAddressInput.hasClass("danger-focus"))
      if (isInputEmpty($cseAddressInput)) redFocusInput($cseAddressInput, false);
      else redFocusInput($cseAddressInput, !cseAddressValidFormat.test($cseAddressInput.val()));
  });

  $("#keyword-input").on("change keyup", () => {
    storeKeywords($keywordInput.val());
    if ($keywordInput.hasClass("danger-focus")) redFocusInput($keywordInput, isInputEmpty($keywordInput));
  });

  $("#pattern-input").on("change keyup", () => {
    storePatterns($patternInput.val());
    if ($patternInput.hasClass("danger-focus")) redFocusInput($patternInput, isInputEmpty($patternInput));
  });

  $("#location-input").on("change keyup", () => {
    storeLocation($locationInput.val());
    if ($locationInput.hasClass("danger-focus")) redFocusInput($locationInput, isInputEmpty($locationInput));
  });

  $("#delay-input").on("input change keyup", () => {
    if (!$delayInput) return;
    storeDelay(parseInt($delayInput.val(), 10) ? parseInt($delayInput.val(), 10) : 0);
    if ($delayInput.hasClass("danger-focus")) redFocusInput($delayInput, isInputEmpty($delayInput));
  });

  $("#deep-search-enabled").on("click", function deepSearchStatus() {
    storeIsDeepSearchEnabled(this.checked);
  });

  $("input").on("paste", () => {
    setTimeout(() => {
      if (!isInputEmpty($cseAddressInput)) redFocusInput($cseAddressInput, false);
      if (!isInputEmpty($delayInput)) redFocusInput($delayInput, false);
    }, 10);
  });

  $("textarea").on("paste", () => {
    setTimeout(() => {
      if (!isInputEmpty($keywordInput)) redFocusInput($keywordInput, false);
      if (!isInputEmpty($patternInput)) redFocusInput($patternInput, false);
      if (!isInputEmpty($locationInput)) redFocusInput($locationInput, false);
    }, 10);
  });

  // Allows only integers for input type number / Enables the maxlength for input type number
  $('input[type="number"]').on("keypress", function _(evt) {
    const charCode = evt.which ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    const attr = $(this).attr("maxlength");
    if (typeof attr !== typeof undefined && attr !== false) {
      if (this.value.length === this.maxLength) return getSelectedText() !== null && getSelectedText() !== ""; // Allows replacing if text is selected
    }
    return true;
  });

  // Handles pasted characters to prevent any invalid value on input type number (float not allowed)
  $('input[type="number"]').on("paste", e => {
    const newText = (e.originalEvent || e).clipboardData.getData("text/plain").trim();
    const currentText = $(e.target).val();
    const maxLength = $(this).attr("maxlength");
    const min = $(this).attr("min");
    const max = $(this).attr("max");
    const parssedToInt = parseInt(newText, 10);
    isInvalid = false;
    isInvalid = !isValidInteger(newText);
    if (!isInvalid && maxLength !== undefined && maxLength !== false) {
      isInvalid = newText.length > maxLength;
    }
    if (!isInvalid && min !== undefined && min !== false) {
      isInvalid = parssedToInt < min;
    }
    if (!isInvalid && max !== undefined && max !== false) {
      isInvalid = parssedToInt > max;
    }
    return !isInvalid;
  });

  // Disables drop text on input type number (preventing to not enter invalid values)
  $('input[type="number"]').on("drop", event => {
    event.preventDefault();
  });

  // Enables multiline placeholder for textarea controls
  const textAreas = $("textarea");
  Array.prototype.forEach.call(textAreas, elem => {
    elem.placeholder = elem.placeholder.replace(/\\n/g, "\n");
  });

  restorePatternsFromStorage();
  restoreKeywordsFromStorage();
  restoreLocationFromStorage();
  restoreCSEAddressFromStorage();
  restoreDelay();
  restoreIsDeepSearchEnabled();
  restoreQueryStatusString();
  restoreDeepSearchStatusString();

  log.i("after query : ", $("#delay-input").val());
});
