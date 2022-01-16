const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const VALUE_INPUT_OPTION = 'USER_ENTERED'; 
const DIMENSION = 'ROWS';
const MAJOR_DIMENSION = 'ROWS';
const ACCOUNT_RANGE = 'List!A2:F2';
const ADJUSTMENT_RANGE = 'adjustment_list!A2:F2';
const ACCOUNT_SHEET_ID = 424497227;
const ADJUSTMENT_SHEET_ID = 206700719;
const ACCOUNT_TEXT_ID = 'account-result-text';
const ADJUSTMENT_TEXT_ID = 'adjustment-result-text';
const SHEETS_FUNCTION = '=if($E2="Ryotaro",$B2*VLOOKUP($D2,adjustment_master!$B:$D, 2, false),0) + if($E2="Wappy",$B2*VLOOKUP($D2,adjustment_master!$B:$D, 3, false),0)';
const METHOD_CASH = 'キャッシュ';
const METHOD_TRANSTPORT = '交通系';
const METHOD_PASMO_CREDIT_CARD = 'Pasmo';
const SUFFIX_REFUND = '(返金)';
const SUFFIX_WAPI_PAY = '(わぴ払い)';
const PAYMENT_BY_RYOH = 'Ryotaro';
const PAYMENT_BY_WAPPY = 'Wappy';
const TYPE_TRANSPORT = '交通費';
const HTML_ID_PURCHASE_DATE = 'purchase_date';
const HTML_ID_PURCHASE_RATE = 'purchase_rate';
const HTML_ID_DESCRIPTION = 'description';
const HTML_ID_AUTH_BUTTON = 'authorize_button';
const HTML_ID_SIGNOUT_BUTTON = 'signout_button';
const HTML_ID_SEND_BUTTON = 'send';
const HTML_ID_PRICE = 'price';
const HTML_ID_PURCHASE_TYPE = 'purchase_type';
const HTML_ID_PURCHASE_METHOD = 'purchase_method';
const HTML_ID_RYOH = 'ryoh';
const HTML_ID_WAPI = 'wapi';

// You have to define following secrets at gitignored files
// const CLIENT_ID =
// const API_KEY = 
// const SPREADSHEET_ID = 

var authorizeButton = document.getElementById(HTML_ID_AUTH_BUTTON);
var signoutButton = document.getElementById(HTML_ID_SIGNOUT_BUTTON);
var sendButton = document.getElementById(HTML_ID_SEND_BUTTON);

/**
 * Call google api
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 * Init Client
 */
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    sendButton.onclick = makeApiCall;
  }, function(error) {
    appendPre(JSON.stringify(error, null, 2));
  });
}

/**
 * Update visiblity of HTML element
 * @param {*} isSignedIn 
 */
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }
}

/**
 * This functions is called when auth button clicked
 * @param {Object} event 
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 * This functions is called when Signout button clicked
 * @param {Object} event 
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

function appendPre(message) {
  var pre = document.getElementById('content');
  var textContent = document.createTextNode(message + '\n');
  pre.appendChild(textContent);
}

/**
 * Get Date String with delimeter spcified by arguments.
 * @param {Date} date 
 * @param {String} delimiter 
 * @returns String
 */
function getDate(date, delimiter) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth()+1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  return `${yyyy}${delimiter}${MM}${delimiter}${dd}`;
}

/**
 * Get Timestamp string
 * @param {Date} date 
 * @returns Timestamp string
 */
function getTimestamp(date) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth()+1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  const HH = `0${date.getHours()}`.slice(-2);
  const mm = `0${date.getMinutes()}`.slice(-2);
  const ss = `0${date.getSeconds()}`.slice(-2);
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

/**
 * Update value via spreadsheets.values.update API
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update
 * @param {Object} params 
 * @param {Object} valueRangeBody 
 * @param {Function} callback 
 */
function updateValue(params, valueRangeBody, fail_callback, success_callback) {
  var request = gapi.client.sheets.spreadsheets.values.update(params, valueRangeBody);
  request.then(success_callback, fail_callback);
}

/**
 * Insert Row via spreadsheets.batchUpdate API
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
 * @param {Function} callback 
 */
function insertRow(sheetId, fail_callback, callback) {
  var params = { spreadsheetId: SPREADSHEET_ID }
  var batchUpdateSpreadsheetRequestBody = {
    requests: [{
      'insertDimension': {
        'range': {
          'sheetId': sheetId,
          'dimension': DIMENSION,
          'startIndex': 1,
          'endIndex': 2
        }
      }
    }],
  };
  var request = gapi.client.sheets.spreadsheets.batchUpdate(params, batchUpdateSpreadsheetRequestBody);
  request.then(callback, fail_callback);
}

/**
 * Construct ValueRange Resources
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values
 * @param {*} range 
 * @param {*} price 
 * @param {*} purchase_type 
 * @param {*} purchase_method 
 * @param {*} suffix 
 * @returns 
 */
function getValueRangeBodyAccount(price, purchase_type, purchase_method, suffix) {
  const timestamp = getTimestamp(new Date());
  const purchase_date = getDate(new Date(document.getElementById(HTML_ID_PURCHASE_DATE).value), '/');
  const description = !!suffix ? `${document.getElementById(HTML_ID_DESCRIPTION).value} ${suffix}` : document.getElementById(HTML_ID_DESCRIPTION).value;

  return {
    'range': ACCOUNT_RANGE,
    'majorDimension': MAJOR_DIMENSION,
    'values': [
      [ timestamp, purchase_date, purchase_type, purchase_method, price, description]
    ]
  };
}

/**
 * Construct ValueRange Resources
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values
 * @param {*} range 
 * @param {*} price 
 * @param {*} purchase_type 
 * @param {*} purchase_method 
 * @param {*} suffix 
 * @returns 
 */
function getValueRangeBodyAdjustment(price, flag) {
  const purchase_date = getDate(new Date(document.getElementById(HTML_ID_PURCHASE_DATE).value), '/');
  const description = document.getElementById(HTML_ID_DESCRIPTION).value;
  const purchase_rate = document.getElementById(HTML_ID_PURCHASE_RATE).value;

  return {
    'range': ADJUSTMENT_RANGE,
    'majorDimension': MAJOR_DIMENSION,
    'values': [
      [ description, price, purchase_date, purchase_rate, flag, SHEETS_FUNCTION]
    ]
  };
}

/**
 * Construct Path & Query Parameters
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update
 * @param {Object} range 
 * @returns URL parameters
 */
function getParams(range) {
  return {
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: VALUE_INPUT_OPTION
  };
}

/**
 * Append transport fee.
 * @param {String} purchase_method 
 * @param {Object} range 
 * @param {Integer} price 
 */
function apprendTransferFee(purchase_method, price, callback) {
  if(purchase_method === METHOD_TRANSTPORT) {
    sendRequestAccount(getValueRangeBodyAccount(price * -1, TYPE_TRANSPORT, METHOD_PASMO_CREDIT_CARD), callback);
  } else {
    callback();
  }
}

/**
 * Call API set (insert and update)
 * @param {Object} valueRangeBody 
 * @param {Function} callback 
 */
function sendRequestAccount(valueRangeBody, callback) {
  updateHTMLText(ACCOUNT_TEXT_ID, 'Account Sending...');
  insertRow(ACCOUNT_SHEET_ID, updateAccountFailText, function(res) {
    updateValue(getParams(ACCOUNT_RANGE), valueRangeBody, updateAccountFailText, callback);
  });
}

/**
 * Call API set (insert and update)
 * @param {Object} valueRangeBody 
 * @param {Function} callback 
 */
function sendRequestAdjustment(valueRangeBody, callback) {
  updateHTMLText(ADJUSTMENT_TEXT_ID, 'Adjustment Sending...');
  insertRow(ADJUSTMENT_SHEET_ID, updateAdjustmentFailText, function(res) {
    updateValue(getParams(ADJUSTMENT_RANGE), valueRangeBody, updateAdjustmentFailText, callback);
  });
}

/**
 * Update text
 * @param {String} text 
 */
function updateHTMLText(id, text) {
  document.getElementById(id).innerText = text;
}

var updateAccountSuccessText = function() {
  updateSuccessText(ACCOUNT_TEXT_ID);
}

var updateAccountFailText = function() {
  updateFailText(ACCOUNT_TEXT_ID);
}

var updateAdjustmentSuccessText = function() {
  updateSuccessText(ADJUSTMENT_TEXT_ID);
}

var updateAdjustmentFailText = function() {
  updateFailText(ADJUSTMENT_TEXT_ID);
}

/**
 * When Sheet API call failed, HTML text is updated.
 */
var updateFailText = function(id) {
  updateHTMLText(id, 'Sheet API call failed...');
  setButtonAvailability(false);
}

/**
 * When Sheet API successfully called, HTML text is updated.
 */
var updateSuccessText = function(id) {
  updateHTMLText(id, 'Sheet API successfully called!');
  setButtonAvailability(false);
}

function setButtonAvailability(isDisable) {
  document.getElementById('send').disabled = isDisable;
}

function getPurchaseRate() {
  const purchase_rate = document.getElementById(HTML_ID_PURCHASE_RATE).value;
  switch(purchase_rate) {
    case "0": // Default
      return 2/3;
    case "1": // Even
      return 1/2;
    case "2": // Ryoh
      return 1;
    case "3": // Wapi
      return 0;
  }
}

/**
 * Make API Call
 */
function makeApiCall() {
  const price = document.getElementById(HTML_ID_PRICE).value;
  const purchase_type = document.getElementById(HTML_ID_PURCHASE_TYPE).value;
  const purchase_method = document.getElementById(HTML_ID_PURCHASE_METHOD).value;
  const ryoh_flag = document.getElementById(HTML_ID_RYOH).checked;
  const wapi_flag = document.getElementById(HTML_ID_WAPI).checked;
  
  // Clear Texts
  updateHTMLText(ACCOUNT_TEXT_ID, '');
  updateHTMLText(ADJUSTMENT_TEXT_ID, '');

  // Init text
  setButtonAvailability(true);
  if(ryoh_flag) {
    sendRequestAccount(getValueRangeBodyAccount(price, purchase_type, purchase_method), function(req, err) {                    
      sendRequestAccount(getValueRangeBodyAccount(Math.round(price * (getPurchaseRate() - 1)), purchase_type, METHOD_CASH, SUFFIX_REFUND), function(req, err) {
        apprendTransferFee(purchase_method, price, updateAccountSuccessText);
      })
    });
    sendRequestAdjustment(getValueRangeBodyAdjustment(price, PAYMENT_BY_RYOH), updateAdjustmentSuccessText);
    return;
  }
  if(wapi_flag) {
    sendRequestAccount(getValueRangeBodyAccount(Math.round(price * getPurchaseRate()), purchase_type, METHOD_CASH, SUFFIX_WAPI_PAY), updateAccountSuccessText);
    sendRequestAdjustment(getValueRangeBodyAdjustment(price, PAYMENT_BY_WAPPY), updateAdjustmentSuccessText);
    return;
  }
  // Default Request
  sendRequestAccount(getValueRangeBodyAccount(price, purchase_type, purchase_method), function(res, err) {
    apprendTransferFee(purchase_method, price, updateAccountSuccessText);
  });
}