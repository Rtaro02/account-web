const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const VALUE_INPUT_OPTION = 'USER_ENTERED'; 
const DIMENSION = "ROWS";
const MAJOR_DIMENSION = "ROWS";

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
function updateValue(params, valueRangeBody, callback) {
  var request = gapi.client.sheets.spreadsheets.values.update(params, valueRangeBody);
  request.then(callback, updateFailText);
}

/**
 * Insert Row via spreadsheets.batchUpdate API
 * https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
 * @param {Function} callback 
 */
function insertRow(callback) {
  var params = { spreadsheetId: SPREADSHEET_ID }
  var batchUpdateSpreadsheetRequestBody = {
    requests: [{
      "insertDimension": {
        "range": {
          "sheetId": 424497227,
          "dimension": DIMENSION,
          "startIndex": 1,
          "endIndex": 2
        }
      }
    }],
  };
  var request = gapi.client.sheets.spreadsheets.batchUpdate(params, batchUpdateSpreadsheetRequestBody);
  request.then(callback, updateFailText);
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
function getValueRangeBody(range, price, purchase_type, purchase_method, suffix) {
  const timestamp = getTimestamp(new Date());
  const purchase_date = getDate(new Date(document.getElementById("purchase_date").value), "/");
  const description = !!suffix ? `${document.getElementById("description").value} ${suffix}` : document.getElementById("description").value;

  return {
    "range": range,
    "majorDimension": MAJOR_DIMENSION,
    "values": [
      [ timestamp, purchase_date, purchase_type, purchase_method, price, description]
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
  if(purchase_method === "交通系") {
    insertRow(function(res, err) {
      updateValue(getParams(range), getValueRangeBody(range, price * -1, "交通費", "Pasmo"), callback);
    });
  } else {
    callback();
  }
}

/**
 * Call API set (insert and update)
 * @param {Object} params 
 * @param {Object} valueRangeBody 
 * @param {Function} callback 
 */
function sendRequest(params, valueRangeBody, callback) {
  insertRow(function(res) {
    updateValue(params, valueRangeBody, callback);
  });
}

/**
 * Update text
 * @param {String} text 
 */
function updateHTMLText(text) {
  document.getElementById("result-text").innerText = text;
}

/**
 * When Sheet API call failed, HTML text is updated.
 */
var updateFailText = function() {
  updateHTMLText("Sheet API call failed...");
}

/**
 * When Sheet API successfully called, HTML text is updated.
 */
var updateSuccessText = function() {
  updateHTMLText("Sheet API successfully called!");
}

/**
 * Make API Call
 */
function makeApiCall() {
  const price = document.getElementById("price").value;
  const purchase_type = document.getElementById("purchase_type").value;
  const purchase_method = document.getElementById("purchase_method").value;
  const ryoh_flag = document.getElementById("ryoh").checked;
  const wapi_flag = document.getElementById("wapi").checked;        
  const range = 'List!A2:F2';

  // Init text
  updateHTMLText("");
  if(ryoh_flag) {
    sendRequest(getParams(range), getValueRangeBody(range, price, purchase_type, purchase_method), function(req, err) {                    
      sendRequest(getParams(range), getValueRangeBody(range, Math.round(price * -1/3), purchase_type, "キャッシュ", '(返金)'), function(req, err) {
        apprendTransferFee(purchase_method, range, price, updateSuccessText);
      });
    });
  } else if(wapi_flag) {
    sendRequest(getParams(range), getValueRangeBody(range, Math.round(price * 2/3), purchase_type, "キャッシュ", '(わぴ払い)'), function(req, err){
      apprendTransferFee(purchase_method, range, price, updateSuccessText);
    });
  } else {
    sendRequest(getParams(range), getValueRangeBody(range, price, purchase_type, purchase_method), function(res, err) {
      apprendTransferFee(purchase_method, range, price, updateSuccessText);
    });
  }
}