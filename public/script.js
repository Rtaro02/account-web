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

// You have to define following secrets at gitignored files
// const CLIENT_ID =
// const API_KEY = 
// const SPREADSHEET_ID = 

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');
var sendButton = document.getElementById('send');

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
function getValueRangeBodyAccount(range, price, purchase_type, purchase_method, suffix) {
  const timestamp = getTimestamp(new Date());
  const purchase_date = getDate(new Date(document.getElementById('purchase_date').value), '/');
  const description = !!suffix ? `${document.getElementById('description').value} ${suffix}` : document.getElementById('description').value;

  return {
    'range': range,
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
function getValueRangeBodyAdjustment(range, price, flag) {
  const purchase_date = getDate(new Date(document.getElementById('purchase_date').value), '/');
  const description = document.getElementById('description').value;
  // 2/3の固定割合
  var wari_flag = 0;
  var sheet_function = '=if($E2="Ryotaro",$B2*VLOOKUP($D2,adjustment_master!$B:$D, 2, false),0) + if($E2="Wappy",$B2*VLOOKUP($D2,adjustment_master!$B:$D, 3, false),0)'

  return {
    'range': range,
    'majorDimension': MAJOR_DIMENSION,
    'values': [
      [ description, price, purchase_date, wari_flag, flag, sheet_function]
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
function apprendTransferFee(purchase_method, range, price, callback) {
  if(purchase_method === '交通系') {
    sendRequestAccount(getValueRangeBodyAccount(range, price * -1, '交通費', 'Pasmo'), callback);
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

/**
 * Make API Call
 */
function makeApiCall() {
  const price = document.getElementById('price').value;
  const purchase_type = document.getElementById('purchase_type').value;
  const purchase_method = document.getElementById('purchase_method').value;
  const ryoh_flag = document.getElementById('ryoh').checked;
  const wapi_flag = document.getElementById('wapi').checked;        

  // Init text
  setButtonAvailability(true);
  if(ryoh_flag) {
    sendRequestAccount(getValueRangeBodyAccount(ACCOUNT_RANGE, price, purchase_type, purchase_method), function(req, err) {                    
      sendRequestAccount(getValueRangeBodyAccount(ACCOUNT_RANGE, Math.round(price * -1/3), purchase_type, 'キャッシュ', '(返金)'), function(req, err) {
        apprendTransferFee(purchase_method, ACCOUNT_RANGE, price, updateAccountSuccessText);
      });
    });
    sendRequestAdjustment(getValueRangeBodyAdjustment(ADJUSTMENT_RANGE, price, "Ryotaro"), updateAdjustmentSuccessText);
  } else if(wapi_flag) {
    sendRequestAccount(getValueRangeBodyAccount(ACCOUNT_RANGE, Math.round(price * 2/3), purchase_type, 'キャッシュ', '(わぴ払い)'), updateAccountSuccessText);
    sendRequestAdjustment(getValueRangeBodyAdjustment(ADJUSTMENT_RANGE, price, "Wappy"), updateAdjustmentSuccessText);
  } else {
    sendRequestAccount(getValueRangeBodyAccount(ACCOUNT_RANGE, price, purchase_type, purchase_method), function(res, err) {
      apprendTransferFee(purchase_method, ACCOUNT_RANGE, price, updateAccountSuccessText);
    });
  }
}