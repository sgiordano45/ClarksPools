// Google Apps Script — March Madness Score Pusher
// Deploy as: Web App > Execute as: Me > Who has access: Anyone
//
// 1. Open your Google Sheet
// 2. Extensions → Apps Script
// 3. Paste this code, replace SHEET_ID below
// 4. Deploy → New deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL and paste into the Score Pusher page
//
// NOTE: If you update this code after already deploying, you must create a
// NEW deployment (not edit existing) for changes to take effect.

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';  // ← replace this

function doPost(e) {
  try {
    const data    = JSON.parse(e.postData.contents);
    const tabName = data.tabName || 'Scores';
    const ss      = SpreadsheetApp.openById(SHEET_ID);

    // Get or create the tab
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Round', 'Winner', 'Winner Score', 'Loser', 'Loser Score']);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    }

    // Build a set of existing round+winner+loser keys to check against
    const lastRow = sheet.getLastRow();
    const existingKeys = new Set();
    if (lastRow > 1) {
      // Columns: 1=Timestamp, 2=Round, 3=Winner, 4=WinnerScore, 5=Loser, 6=LoserScore
      const existingData = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      existingData.forEach(row => {
        const round  = row[1];
        const winner = row[2];
        const loser  = row[4];
        if (round && winner && loser) {
          existingKeys.add(round + '|' + winner + '|' + loser);
        }
      });
    }

    const rows    = data.games || [];
    let   written = 0;
    let   skipped = 0;

    rows.forEach(g => {
      const key = g.round + '|' + g.winner + '|' + g.loser;
      if (existingKeys.has(key)) {
        skipped++;
        return; // already in sheet, skip
      }
      sheet.appendRow([
        new Date().toLocaleString(),
        g.round,
        g.winner,
        g.winnerScore,
        g.loser,
        g.loserScore
      ]);
      existingKeys.add(key); // prevent dupes within the same push batch
      written++;
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, written, skipped }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: test this by running doGet to confirm the script is live
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Score Pusher is live.' }))
    .setMimeType(ContentService.MimeType.JSON);
}
