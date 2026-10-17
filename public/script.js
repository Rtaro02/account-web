/**
 * My Account - Google Sheets API 連携スクリプト
 * Google Identity Services (GIS) & ES6+ async/await 対応
 */

// ==========================================
// 定数設定
// ==========================================
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
const ACCOUNT_CARD_ID = 'account-result-card';
const ADJUSTMENT_CARD_ID = 'adjustment-result-card';

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

// ==========================================
// 状態変数 & ストレージキー
// ==========================================
const STORAGE_KEY_TOKEN = 'account_web_gapi_token';
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

// ==========================================
// トークン永続化 (localStorage) ヘルパー
// ==========================================

function saveToken(resp) {
  try {
    const expiresIn = Number(resp.expires_in) || 3600;
    const tokenData = {
      token: resp,
      expiresAt: Date.now() + (expiresIn - 60) * 1000 // 1分前の安全マージン
    };
    localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify(tokenData));
  } catch (e) {
    console.error('トークン保存エラー:', e);
  }
}

function getSavedToken() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    return null;
  }
}

function clearSavedToken() {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  } catch (e) {
    console.error('トークン削除エラー:', e);
  }
}

/**
 * 保存されたトークンがあり、有効期限内なら復元する
 */
function restoreTokenIfValid() {
  const saved = getSavedToken();
  if (!saved) return false;

  if (Date.now() < saved.expiresAt) {
    gapi.client.setToken(saved.token);
    updateAuthUI(true);
    logMessage('保存された認証セッションを復元しました（有効期限内）。');
    return true;
  } else {
    clearSavedToken();
    logMessage('前回の認証セッションの有効期限が切れています。');
    return false;
  }
}

// ==========================================
// Google API & GIS 初期化フロー
// ==========================================

/**
 * gapi.js ロード完了時コールバック
 */
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

/**
 * GAPI Client の初期化 (Sheets API Discovery Doc の読み込み)
 */
async function initializeGapiClient() {
  try {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    logMessage('GAPI Client 初期化完了');
    checkInitState();
  } catch (error) {
    logMessage('GAPI Client 初期化エラー: ' + JSON.stringify(error, null, 2));
    showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, 'GAPI初期化エラー: ' + (error.message || 'APIキー等を確認してください'), 'error');
  }
}

/**
 * GIS (Google Identity Services) スクリプト ロード完了時コールバック
 */
function gisLoaded() {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // handleAuthClick で動的に設定
    });
    gisInited = true;
    logMessage('GIS Token Client 初期化完了');
    checkInitState();
  } catch (error) {
    logMessage('GIS 初期化エラー: ' + JSON.stringify(error, null, 2));
    showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, 'GIS初期化エラー: ' + (error.message || 'Client ID等を確認してください'), 'error');
  }
}

/**
 * GAPI と GIS 両方のロードが完了したか確認
 */
function checkInitState() {
  if (gapiInited && gisInited) {
    logMessage('Google 認証システムの準備が整いました。');
    const authBtn = document.getElementById(HTML_ID_AUTH_BUTTON);
    authBtn.disabled = false;

    // 前回のトークンがあれば自動復元
    const restored = restoreTokenIfValid();
    if (!restored) {
      updateAuthUI(false);
    }
  }
}

/**
 * ログイン / 認証ボタン押下時のハンドラ
 */
function handleAuthClick() {
  if (!tokenClient) {
    alert('Google Identity サービスがまだ準備完了していません。数秒後にお試しください。');
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      logMessage('認証エラー: ' + JSON.stringify(resp));
      updateAuthUI(false);
      clearSavedToken();
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '認証に失敗しました: ' + resp.error, 'error');
      return;
    }

    // トークンを GAPI クライアントへセット & localStorage に保持
    gapi.client.setToken(resp);
    saveToken(resp);
    updateAuthUI(true);
    logMessage('Google 認証成功。アクセストークンを保持しました。');
  };

  // トークンが未取得または期限切れの場合はプロンプトを表示
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

/**
 * サインアウトボタン押下時のハンドラ
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  clearSavedToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
      updateAuthUI(false);
      logMessage('Google アカウントからサインアウトしました。');
    });
  } else {
    gapi.client.setToken('');
    updateAuthUI(false);
    logMessage('サインアウトしました。');
  }
}

/**
 * 認証状態に応じた UI 表示の更新
 */
function updateAuthUI(isSignedIn) {
  const authBtn = document.getElementById(HTML_ID_AUTH_BUTTON);
  const signoutBtn = document.getElementById(HTML_ID_SIGNOUT_BUTTON);
  const sendBtn = document.getElementById(HTML_ID_SEND_BUTTON);
  const authStatus = document.getElementById('auth_status');
  const authStatusText = document.getElementById('auth_status_text');

  if (isSignedIn) {
    authBtn.style.display = 'none';
    signoutBtn.style.display = 'inline-flex';
    authStatus.classList.add('connected');
    authStatusText.innerText = '接続済み';
    sendBtn.disabled = false;
  } else {
    authBtn.style.display = 'inline-flex';
    signoutBtn.style.display = 'none';
    authStatus.classList.remove('connected');
    authStatusText.innerText = '未接続';
    sendBtn.disabled = true;
  }
}

// ==========================================
// 日時フォーマット用ユーティリティ
// ==========================================

function getDate(date, delimiter) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth() + 1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  return `${yyyy}${delimiter}${MM}${delimiter}${dd}`;
}

function getTimestamp(date) {
  const yyyy = date.getFullYear();
  const MM = `0${date.getMonth() + 1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);
  const HH = `0${date.getHours()}`.slice(-2);
  const mm = `0${date.getMinutes()}`.slice(-2);
  const ss = `0${date.getSeconds()}`.slice(-2);
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

// ==========================================
// スプレッドシート API 呼び出し (Promise / async)
// ==========================================

/**
 * シートに新規行を上部に挿入する (batchUpdate)
 */
async function insertRow(sheetId) {
  const params = { spreadsheetId: SPREADSHEET_ID };
  const batchUpdateRequest = {
    requests: [{
      insertDimension: {
        range: {
          sheetId: sheetId,
          dimension: DIMENSION,
          startIndex: 1,
          endIndex: 2
        }
      }
    }]
  };
  return await gapi.client.sheets.spreadsheets.batchUpdate(params, batchUpdateRequest);
}

/**
 * 指定した範囲のセルを更新する (values.update)
 */
async function updateValue(range, valueRangeBody) {
  const params = {
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: VALUE_INPUT_OPTION,
    resource: valueRangeBody
  };
  return await gapi.client.sheets.spreadsheets.values.update(params, valueRangeBody);
}

/**
 * 行挿入と値更新を一連のフローとして実行
 */
async function insertAndUpdate(sheetId, range, valueRangeBody) {
  await insertRow(sheetId);
  return await updateValue(range, valueRangeBody);
}

// ==========================================
// 送信用データ構築
// ==========================================

function getValueRangeBodyAccount(price, purchase_type, purchase_method, suffix) {
  const timestamp = getTimestamp(new Date());
  const rawDate = document.getElementById(HTML_ID_PURCHASE_DATE).value;
  const purchase_date = getDate(new Date(rawDate), '/');
  const baseDesc = document.getElementById(HTML_ID_DESCRIPTION).value.trim();
  const description = suffix ? `${baseDesc} ${suffix}`.trim() : baseDesc;

  return {
    range: ACCOUNT_RANGE,
    majorDimension: MAJOR_DIMENSION,
    values: [
      [timestamp, purchase_date, purchase_type, purchase_method, Number(price), description]
    ]
  };
}

function getValueRangeBodyAdjustment(price, flag) {
  const rawDate = document.getElementById(HTML_ID_PURCHASE_DATE).value;
  const purchase_date = getDate(new Date(rawDate), '/');
  const description = document.getElementById(HTML_ID_DESCRIPTION).value.trim();
  const purchase_rate = document.getElementById(HTML_ID_PURCHASE_RATE).value;

  return {
    range: ADJUSTMENT_RANGE,
    majorDimension: MAJOR_DIMENSION,
    values: [
      [description, Number(price), purchase_date, purchase_rate, flag, SHEETS_FUNCTION]
    ]
  };
}

function getPurchaseRate() {
  const purchase_rate = document.getElementById(HTML_ID_PURCHASE_RATE).value;
  switch (purchase_rate) {
    case '0': // Default (2:1)
      return 2 / 3;
    case '1': // Even (1:1)
      return 1 / 2;
    case '2': // Ryoh (1:0)
      return 1;
    case '3': // Wapi (0:1)
      return 0;
    default:
      return 2 / 3;
  }
}

// ==========================================
// メイン送信処理 (makeApiCall)
// ==========================================

async function makeApiCall() {
  const sendBtn = document.getElementById(HTML_ID_SEND_BUTTON);
  const priceInput = document.getElementById(HTML_ID_PRICE);
  const price = priceInput.value;
  const purchase_type = document.getElementById(HTML_ID_PURCHASE_TYPE).value;
  const purchase_method = document.getElementById(HTML_ID_PURCHASE_METHOD).value;
  const ryoh_flag = document.getElementById(HTML_ID_RYOH).checked;
  const wapi_flag = document.getElementById(HTML_ID_WAPI).checked;

  if (!price || Number(price) <= 0) {
    alert('有効な金額を入力してください。');
    priceInput.focus();
    return;
  }

  // 認証チェック & 有効期限チェック
  const savedToken = getSavedToken();
  if (!gapi.client.getToken() || (savedToken && Date.now() >= savedToken.expiresAt)) {
    logMessage('認証セッションが切れているため、再認証を行います。');
    alert('認証セッションが切れています。再度 Google ログインを行ってください。');
    handleAuthClick();
    return;
  }

  // 送信中ステート開始
  setSendingState(true);
  clearResults();

  try {
    if (ryoh_flag) {
      // 1. りょう払い案件
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, 'りょう払い明細を登録中...', 'info');
      await insertAndUpdate(
        ACCOUNT_SHEET_ID,
        ACCOUNT_RANGE,
        getValueRangeBodyAccount(price, purchase_type, purchase_method)
      );

      // 返金レコード
      const refundAmount = Math.round(Number(price) * (getPurchaseRate() - 1));
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '返金調整レコードを登録中...', 'info');
      await insertAndUpdate(
        ACCOUNT_SHEET_ID,
        ACCOUNT_RANGE,
        getValueRangeBodyAccount(refundAmount, purchase_type, METHOD_CASH, SUFFIX_REFUND)
      );

      // 交通系の場合のチャージ相殺
      if (purchase_method === METHOD_TRANSTPORT) {
        showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '交通費精算レコードを登録中...', 'info');
        await insertAndUpdate(
          ACCOUNT_SHEET_ID,
          ACCOUNT_RANGE,
          getValueRangeBodyAccount(Number(price) * -1, TYPE_TRANSPORT, METHOD_PASMO_CREDIT_CARD)
        );
      }
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '✓ 家計簿(List)への登録が完了しました！', 'success');

      // 精算リストへの登録
      showResult(ADJUSTMENT_CARD_ID, ADJUSTMENT_TEXT_ID, '精算リスト(adjustment_list)へ登録中...', 'info');
      await insertAndUpdate(
        ADJUSTMENT_SHEET_ID,
        ADJUSTMENT_RANGE,
        getValueRangeBodyAdjustment(price, PAYMENT_BY_RYOH)
      );
      showResult(ADJUSTMENT_CARD_ID, ADJUSTMENT_TEXT_ID, '✓ 精算リストへの登録が完了しました！', 'success');

    } else if (wapi_flag) {
      // 2. わぴ払い案件
      const wapiShare = Math.round(Number(price) * getPurchaseRate());
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, 'わぴ払い明細を登録中...', 'info');
      await insertAndUpdate(
        ACCOUNT_SHEET_ID,
        ACCOUNT_RANGE,
        getValueRangeBodyAccount(wapiShare, purchase_type, METHOD_CASH, SUFFIX_WAPI_PAY)
      );
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '✓ 家計簿(List)への登録が完了しました！', 'success');

      // 精算リストへの登録
      showResult(ADJUSTMENT_CARD_ID, ADJUSTMENT_TEXT_ID, '精算リスト(adjustment_list)へ登録中...', 'info');
      await insertAndUpdate(
        ADJUSTMENT_SHEET_ID,
        ADJUSTMENT_RANGE,
        getValueRangeBodyAdjustment(price, PAYMENT_BY_WAPPY)
      );
      showResult(ADJUSTMENT_CARD_ID, ADJUSTMENT_TEXT_ID, '✓ 精算リストへの登録が完了しました！', 'success');

    } else {
      // 3. 通常の支出
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '支出明細を登録中...', 'info');
      await insertAndUpdate(
        ACCOUNT_SHEET_ID,
        ACCOUNT_RANGE,
        getValueRangeBodyAccount(price, purchase_type, purchase_method)
      );

      // 交通系の場合のチャージ相殺
      if (purchase_method === METHOD_TRANSTPORT) {
        showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '交通費精算レコードを登録中...', 'info');
        await insertAndUpdate(
          ACCOUNT_SHEET_ID,
          ACCOUNT_RANGE,
          getValueRangeBodyAccount(Number(price) * -1, TYPE_TRANSPORT, METHOD_PASMO_CREDIT_CARD)
        );
      }
      showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '✓ 家計簿(List)への登録が完了しました！', 'success');
    }

    logMessage(`送信完了: ¥${price} (${purchase_type} / ${purchase_method})`);
    
    // 成功時、フォームの一部をリセット（金額と概要）
    priceInput.value = '';
    document.getElementById(HTML_ID_DESCRIPTION).value = '';

  } catch (error) {
    console.error('API Error:', error);
    const errorDetails = error.result?.error?.message || error.message || JSON.stringify(error);
    showResult(ACCOUNT_CARD_ID, ACCOUNT_TEXT_ID, '送信エラー: ' + errorDetails, 'error');
    logMessage('エラー詳細: ' + errorDetails);
  } finally {
    setSendingState(false);
  }
}

// ==========================================
// UI フィードバック & ヘルパー
// ==========================================

function setSendingState(isLoading) {
  const sendBtn = document.getElementById(HTML_ID_SEND_BUTTON);
  const btnText = document.getElementById('btn_text');
  if (isLoading) {
    sendBtn.classList.add('loading');
    sendBtn.disabled = true;
    btnText.innerText = '送信中...';
  } else {
    sendBtn.classList.remove('loading');
    sendBtn.disabled = false;
    btnText.innerText = 'スプレッドシートへ送信';
  }
}

function showResult(cardId, textId, message, type) {
  const card = document.getElementById(cardId);
  const text = document.getElementById(textId);
  if (!card || !text) return;

  card.className = `result-card ${type}`;
  text.innerText = message;
  card.style.display = 'flex';
}

function clearResults() {
  const accCard = document.getElementById(ACCOUNT_CARD_ID);
  const adjCard = document.getElementById(ADJUSTMENT_CARD_ID);
  if (accCard) accCard.style.display = 'none';
  if (adjCard) adjCard.style.display = 'none';
}

function logMessage(msg) {
  const pre = document.getElementById('content');
  if (pre) {
    const time = new Date().toLocaleTimeString();
    pre.textContent += `[${time}] ${msg}\n`;
    pre.scrollTop = pre.scrollHeight;
  }
  console.log(`[My Account] ${msg}`);
}

// ==========================================
// DOM 初期化 & イベントリスナー設定
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // 当日の日付をセット
  const dateInput = document.getElementById(HTML_ID_PURCHASE_DATE);
  if (dateInput) {
    dateInput.value = getDate(new Date(), '-');
  }

  // ボタンイベント紐付け
  const authBtn = document.getElementById(HTML_ID_AUTH_BUTTON);
  const signoutBtn = document.getElementById(HTML_ID_SIGNOUT_BUTTON);
  const sendBtn = document.getElementById(HTML_ID_SEND_BUTTON);

  if (authBtn) authBtn.onclick = handleAuthClick;
  if (signoutBtn) signoutBtn.onclick = handleSignoutClick;
  if (sendBtn) sendBtn.onclick = makeApiCall;

  // チェックボックス（りょう払い・わぴ払い）の排他制御 & カードスタイル連動
  const ryohCheckbox = document.getElementById(HTML_ID_RYOH);
  const wapiCheckbox = document.getElementById(HTML_ID_WAPI);
  const ryohCard = document.getElementById('ryoh_card');
  const wapiCard = document.getElementById('wapi_card');

  if (ryohCheckbox && wapiCheckbox) {
    ryohCheckbox.addEventListener('change', () => {
      if (ryohCheckbox.checked) {
        wapiCheckbox.checked = false;
        wapiCard.classList.remove('checked');
        ryohCard.classList.add('checked');
      } else {
        ryohCard.classList.remove('checked');
      }
    });

    wapiCheckbox.addEventListener('change', () => {
      if (wapiCheckbox.checked) {
        ryohCheckbox.checked = false;
        ryohCard.classList.remove('checked');
        wapiCard.classList.add('checked');
      } else {
        wapiCard.classList.remove('checked');
      }
    });
  }

  logMessage('DOM 読み込み完了');
});