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
var inputDate = document.getElementById('purchase_date');

function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

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
    send.onclick = makeApiCall;
  }, function(error) {
    appendPre(JSON.stringify(error, null, 2));
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }
}

function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

function appendPre(message) {
  var pre = document.getElementById('content');
  var textContent = document.createTextNode(message + '\n');
  pre.appendChild(textContent);
}

function getDate(date, delimiter) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth()+1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  return `${yyyy}${delimiter}${MM}${delimiter}${dd}`;
}

function getTimestamp(date) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth()+1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  const HH = `0${date.getHours()}`.slice(-2);
  const mm = `0${date.getMinutes()}`.slice(-2);
  const ss = `0${date.getSeconds()}`.slice(-2);
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

function updateValue(params, valueRangeBody, callback) {
  var request = gapi.client.sheets.spreadsheets.values.update(params, valueRangeBody);
  request.then(callback);
}

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
  request.then(callback);
}

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

function getParams(range) {
  return {
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: VALUE_INPUT_OPTION
  };
}

function apprendTransferFee(purchase_method, range, price) {
  if(purchase_method === "交通系") {
    insertRow(function(res, err) {
      updateValue(getParams(range), getValueRangeBody(range, price * -1, "交通費", "Pasmo"));
    });
  }
}

function sendRequest(params, valueRangeBody, callback) {
  insertRow(function(res, err) {
    updateValue(params, valueRangeBody, callback);
  });
}

function makeApiCall() {
  const price = document.getElementById("price").value;
  const purchase_type = document.getElementById("purchase_type").value;
  const purchase_method = document.getElementById("purchase_method").value;
  const ryoh_flag = document.getElementById("ryoh").checked;
  const wapi_flag = document.getElementById("wapi").checked;        
  const range = 'List!A2:F2';
  if(ryoh_flag) {
    sendRequest(getParams(range), getValueRangeBody(range, price, purchase_type, purchase_method), function(req, err) {                    
      sendRequest(getParams(range), getValueRangeBody(range, Math.round(price * -1/3), purchase_type, "キャッシュ", '(返金)'), function(req, err) {
        apprendTransferFee(purchase_method, range, price);
      });
    });
  } else if(wapi_flag) {
    sendRequest(getParams(range), getValueRangeBody(range, Math.round(price * 2/3), purchase_type, "キャッシュ", '(わぴ払い)'), function(req, err){
      apprendTransferFee(purchase_method, range, price);
    });
  } else {
    sendRequest(getParams(range), getValueRangeBody(range, price, purchase_type, purchase_method), function(res, err) {
      apprendTransferFee(purchase_method, range, price);
    });
  }
}