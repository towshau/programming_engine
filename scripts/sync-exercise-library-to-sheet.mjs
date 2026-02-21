#!/usr/bin/env node
/**
 * Syncs exercise_library table from Supabase to a Google Sheet.
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_SHEET_ID (optional), GOOGLE_SERVICE_ACCOUNT_JSON
 */

const DEFAULT_SHEET_ID = '1TAAXFk-etpeO3pLAhJPOmQadw9PB3Y6Th78hcJ7C8uo';

function getEnv(name) {
  const v = process.env[name];
  if (!v && (name === 'SUPABASE_URL' || name === 'SUPABASE_ANON_KEY' || name === 'GOOGLE_SERVICE_ACCOUNT_JSON')) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

async function fetchExerciseLibrary() {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_ANON_KEY');
  const apiUrl = `${url.replace(/\/$/, '')}/rest/v1/exercise_library?select=exercise_id,exercise_name,tags&order=exercise_id`;
  const res = await fetch(apiUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function writeToSheet(rows) {
  const sheetId = getEnv('GOOGLE_SHEET_ID') || DEFAULT_SHEET_ID;
  const raw = getEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetName = 'Sheet1';
  const range = `${sheetName}!A:Z`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1:Z`,
  });

  const valueRange = {
    range: `${sheetName}!A1`,
    values: rows,
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: valueRange.range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: valueRange.values },
  });

  return { sheetId, rowsWritten: rows.length };
}

async function main() {
  console.log('Fetching exercise_library from Supabase...');
  const data = await fetchExerciseLibrary();
  const header = [['exercise_id', 'exercise_name', 'tags']];
  const rows = data.map((r) => [
    r.exercise_id ?? '',
    r.exercise_name ?? '',
    r.tags ?? '',
  ]);
  const allRows = header.concat(rows);
  console.log(`Fetched ${rows.length} rows. Writing to Google Sheet...`);
  const result = await writeToSheet(allRows);
  console.log(`Done. Wrote ${result.rowsWritten} rows to sheet ${result.sheetId}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
