/**
 * Supabase → TeamBuildr upload planner
 *
 * Queries finalized programs (coach_approved, not uploaded), maps session days
 * to weekday calendar dates, and prints what needs uploading so admins can do
 * it manually in TeamBuildr.
 *
 * The --live / Playwright automation is retained but **experimental** — TB's
 * modal-heavy UI is fragile to automate. For now, use this script as a
 * planning tool and upload exercises by hand.
 *
 * Usage:
 *   npx ts-node upload-programs.ts                         # plan: show pending uploads
 *   npx ts-node upload-programs.ts --program-id <uuid>     # plan for single program
 *   npx ts-node upload-programs.ts --mark-uploaded          # mark program uploaded after manual entry
 *   npx ts-node upload-programs.ts --live                   # (experimental) browser automation
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required).
 *      TEAMBUILDER_EMAIL, TEAMBUILDER_PASSWORD, GYM_TIMEZONE (for --live only).
 */

import { chromium, type Browser, type Page } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import fs from "fs";

// Repo root .env (same as Python tools), then teambuilder-sync/.env overrides
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  teambuilder: {
    email: process.env.TEAMBUILDER_EMAIL || "",
    password: process.env.TEAMBUILDER_PASSWORD || "",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  browser: {
    headless: process.env.PLAYWRIGHT_HEADLESS === "1",
    slowMo: Number(process.env.PLAYWRIGHT_SLOWMO || "300"),
    timeout: 30000,
  },
  gymTimezone: process.env.GYM_TIMEZONE || "Australia/Sydney",
};

const PROGRESS_FILE = path.resolve(__dirname, "upload-progress.json");

// ============================================================================
// TYPES
// ============================================================================

interface ProgramRow {
  id: string;
  member_id: string;
  sessions_per_week: number;
  next_due_date: string | null;
  payload: {
    sessions: Array<{
      day: number;
      exercises: ExerciseEntry[];
    }>;
  };
}

interface ExerciseEntry {
  exercise_name: string;
  exercise_id?: string;
  series_label?: string;
  tags?: string;
  sets?: Array<{ set_number: number; reps: string }>;
  notes?: string;
}

interface PendingProgram extends ProgramRow {
  member_name: string | null;
}

interface MappedSession {
  day: number;
  calendarDate: string;
  exercises: ExerciseEntry[];
}

interface UploadProgress {
  started_at: string;
  completed: string[];
  failed: Array<{ program_id: string; member_name: string; error: string }>;
  skipped: Array<{ program_id: string; member_name: string; reason: string }>;
}

// ============================================================================
// SELECTORS — calendar chrome + "Adding Lift" modal (TeamBuildr 2026-03)
// ============================================================================
// Flow: day → Clear → Workouts → for each exercise: Add Exercise → modal:
// Search for Exercise → pick result → Sets <select> → Reps field = CUST →
// fill per-set rep inputs → Add to Workout → Save (top bar).

/**
 * TeamBuildr calendar: top bar <a class="calendar_btn ...">.
 * Week view: green "Add Exercise" opens **Adding Lift** modal (search + sets + reps).
 */
const TB_SELECTORS = {
  addWorkoutButton: "a#view_workout.build_workout",
  editWorkoutButton: "a#view_workout.build_workout",
  deleteWorkoutButton: "a.clear_workout",
  confirmDeleteButton:
    "button.btn-primary:has-text('OK'), button:has-text('Confirm'), .modal button:has-text('OK')",

  /** Bottom of day workout list (green +) */
  addExerciseButton: 'text=Add Exercise',

  /** Typeahead / dropdown row after searching */
  exerciseResultItem:
    ".tt-suggestion, .tt-selectable, li.tt-suggestion, [role='listbox'] [role='option'], " +
    ".autocomplete-suggestion, .dropdown-menu li, ul.dropdown-menu li",

  /** Main reps text box (hint mentions 'C' for custom); we type CUST */
  repsMainInput:
    'input[placeholder="Reps"], input[placeholder*="Reps" i], input[placeholder*="# Reps" i]',

  /** Per-set rep cells after custom mode (tables under modal) */
  customRepSetInputs:
    'table[id^="cust_load_table_"] input, table.table input[type="text"], table input[type="text"]',

  saveWorkoutButton: "a.save_workout",
  addToWorkoutButton: 'button:has-text("Add to Workout")',
};

/** Rep string for set index `i` from engine payload (falls back to first set). */
function repsForSet(ex: ExerciseEntry, setIndex: number): string {
  const sets = ex.sets || [];
  const row = sets[setIndex];
  if (row?.reps != null && String(row.reps).trim() !== "") {
    return String(row.reps).trim();
  }
  const first = sets[0]?.reps;
  if (first != null && String(first).trim() !== "") {
    return String(first).trim();
  }
  return "10";
}

function selectAllShortcut(): string {
  return process.platform === "darwin" ? "Meta+A" : "Control+A";
}

function assertSelectorsConfigured(): void {
  const placeholders = Object.entries(TB_SELECTORS).filter(([, v]) =>
    v.startsWith("TODO_SELECTOR")
  );
  if (placeholders.length > 0) {
    const names = placeholders.map(([k]) => k).join(", ");
    throw new Error(
      `TeamBuildr selectors not configured: ${names}. ` +
        "Run inspect-teambuilder.ts, record the selectors, and update TB_SELECTORS in upload-programs.ts."
    );
  }
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function todayYmdInTimeZone(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOfWeekContaining(ymd: string): string {
  const d = parseYmd(ymd);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getTime() + offset * 86400000);
  return formatYmd(mon);
}

function weekdayTrainingDates(anchorMondayYmd: string, count: number): string[] {
  const out: string[] = [];
  let cur = parseYmd(anchorMondayYmd);
  const maxIterations = count * 4;
  let iter = 0;
  while (out.length < count && iter < maxIterations) {
    iter++;
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      out.push(formatYmd(cur));
    }
    cur = new Date(cur.getTime() + 86400000);
  }
  if (out.length < count) {
    throw new Error(
      `Could not map ${count} weekday session(s) from anchor ${anchorMondayYmd}`
    );
  }
  return out;
}

function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function mapSessionsToDates(
  program: ProgramRow,
  anchorMondayYmd: string
): MappedSession[] {
  const sessions = [...program.payload.sessions].sort(
    (x, y) => x.day - y.day
  );
  if (sessions.length === 0) {
    throw new Error("Program payload has no sessions");
  }
  const dates = weekdayTrainingDates(anchorMondayYmd, sessions.length);
  return sessions.map((s, i) => ({
    day: s.day,
    calendarDate: dates[i]!,
    exercises: s.exercises || [],
  }));
}

function filterFutureOrEqualDates(
  rows: MappedSession[],
  todayYmd: string
): { uploadable: MappedSession[]; skippedPast: MappedSession[] } {
  const uploadable: MappedSession[] = [];
  const skippedPast: MappedSession[] = [];
  for (const r of rows) {
    if (compareYmd(r.calendarDate, todayYmd) >= 0) {
      uploadable.push(r);
    } else {
      skippedPast.push(r);
    }
  }
  return { uploadable, skippedPast };
}

// ============================================================================
// EXERCISE NAME MATCHING (shared with pull-sync)
// ============================================================================

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(ea\.?|each)\b/g, "")
    .trim();
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

function loadProgress(): UploadProgress | null {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveProgress(progress: UploadProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================================================
// SUPABASE
// ============================================================================

class SupabaseUpload {
  private client: SupabaseClient;

  constructor() {
    if (!CONFIG.supabase.url || !CONFIG.supabase.serviceKey) {
      throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    }
    this.client = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey);
  }

  async fetchPendingUploads(options: {
    programId?: string;
    limit?: number;
  }): Promise<PendingProgram[]> {
    let q = this.client
      .from("programming_generated")
      .select(
        "id, member_id, sessions_per_week, next_due_date, payload, coach_approved, uploaded_to_teambuildr"
      )
      .eq("coach_approved", true)
      .eq("uploaded_to_teambuildr", false)
      .order("next_due_date", { ascending: true, nullsFirst: false });

    if (options.programId) {
      q = q.eq("id", options.programId);
    }
    if (options.limit && options.limit > 0) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);

    const rows = (data || []) as ProgramRow[];
    const memberIds = [...new Set(rows.map((r) => r.member_id))];
    const nameById = new Map<string, string>();

    if (memberIds.length > 0) {
      const { data: members, error: mErr } = await this.client
        .from("member_database")
        .select("id, member_name")
        .in("id", memberIds);

      if (mErr) throw new Error(`member_database fetch failed: ${mErr.message}`);
      for (const m of members || []) {
        nameById.set(m.id as string, (m as { member_name: string }).member_name);
      }
    }

    return rows.map((r) => ({
      ...r,
      member_name: nameById.get(r.member_id) ?? null,
    }));
  }

  async markUploaded(programId: string): Promise<boolean> {
    const { error } = await this.client
      .from("programming_generated")
      .update({
        uploaded_to_teambuildr: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId);

    if (error) {
      console.error(chalk.red(`  markUploaded failed: ${error.message}`));
      return false;
    }
    return true;
  }

  async updateMemberDueDate(memberId: string, nextDueDate: string): Promise<boolean> {
    const { error } = await this.client
      .from("member_programs")
      .update({ due_date: nextDueDate })
      .eq("member_id", memberId);

    if (error) {
      console.error(chalk.red(`  updateMemberDueDate failed: ${error.message}`));
      return false;
    }
    return true;
  }
}

// ============================================================================
// TEAMBUILDR BROWSER AUTOMATION
// ============================================================================

class TeamBuildrUploader {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: CONFIG.browser.headless,
      slowMo: CONFIG.browser.slowMo,
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(CONFIG.browser.timeout);
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    console.log(chalk.blue("  Logging into TeamBuildr..."));
    await page.goto("https://app.teambuildr.com");

    try {
      await page.locator('button:has-text("Accept Cookies")').click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch {
      /* no banner */
    }

    await page.waitForSelector(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      { timeout: 15000 }
    );
    await page.fill(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      CONFIG.teambuilder.email
    );
    await page.click('button:has-text("NEXT")');

    await page.waitForSelector('input[placeholder*="Password" i]', {
      timeout: 10000,
    });
    const pwdInput = page.locator('input[placeholder*="Password" i]');
    await pwdInput.click();
    await pwdInput.pressSequentially(CONFIG.teambuilder.password, { delay: 50 });

    const signInBtn = page.locator('button:has-text("SIGN IN")');
    await signInBtn.waitFor({ state: "visible", timeout: 5000 });
    await page.waitForTimeout(500);
    await signInBtn.click();

    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 20000 }
    );
    await page.waitForLoadState("domcontentloaded");

    await page.goto("https://app.teambuildr.com/calendar", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    console.log(chalk.green("  Logged in"));
  }

  async selectMember(memberName: string): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    const parts = memberName.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
    const tbFormat = firstName ? `${lastName}, ${firstName}` : lastName;

    try {
      await page.goto("https://app.teambuildr.com/calendar", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1500);

      await page.click('text="Select Calendar"');
      await page.waitForTimeout(1000);
      await page.click('text="Athlete Calendars"');
      await page.waitForTimeout(500);

      const searchInput = page
        .locator('input[placeholder="Search for Athlete"]')
        .first();
      await searchInput.fill(lastName);
      await page.waitForTimeout(2000);

      const link = page.locator(`a:has-text("${tbFormat}")`).first();
      const fallback = page.locator(`a:has-text("${lastName}")`).first();
      const target = (await link.count()) > 0 ? link : fallback;

      if ((await target.count()) === 0) {
        await searchInput.fill(memberName);
        await page.waitForTimeout(2000);
        const lastTry = page.locator(`a:has-text("${lastName}")`).first();
        if ((await lastTry.count()) === 0) {
          throw new Error("No matching athlete link found");
        }
        await lastTry.click({ timeout: 5000 });
      } else {
        await target.click({ timeout: 5000 });
      }

      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      return true;
    } catch (err: any) {
      console.log(chalk.red(`  Could not find member: ${err.message?.slice(0, 100)}`));
      try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } catch {}
      return false;
    }
  }

  async navigateToDate(targetDate: string): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    // Calendar day divs have class like "calendar-day-2026-03-25"
    const selector = `.day.calendar-day-${targetDate}`;
    const cell = page.locator(selector).first();

    if ((await cell.count()) === 0) {
      // Fallback: match by day number text in any .day cell
      const [, , day] = targetDate.split("-").map(Number);
      const fallback = page.locator(`.day`).filter({ hasText: new RegExp(`^${day}$`) }).first();
      if ((await fallback.count()) > 0) {
        await fallback.click({ timeout: 5000 });
      } else {
        console.log(chalk.yellow(`    Could not find calendar cell for ${targetDate}`));
        return false;
      }
    } else {
      await cell.click({ timeout: 5000 });
    }

    await page.waitForTimeout(2000);
    await page.waitForLoadState("domcontentloaded");
    return true;
  }

  /**
   * Bootstrap modal "Adding Lift": search exercise, sets count, CUST reps, per-set values, Add to Workout.
   */
  private async addExerciseThroughAddingLiftModal(ex: ExerciseEntry): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    try {
      await page.locator(TB_SELECTORS.addExerciseButton).first().click({ timeout: 15000 });
      await page.getByPlaceholder(/Search for Exercise/i).first().waitFor({
        state: "visible",
        timeout: 15000,
      });

      const modal = page.locator(".modal:visible, .modal.show, .modal.in").last();

      const search = modal.getByPlaceholder(/Search for Exercise/i).first();
      await search.click();
      await search.fill("");
      await search.fill(ex.exercise_name.trim());
      await page.waitForTimeout(1400);

      const result = page.locator(TB_SELECTORS.exerciseResultItem).first();
      if ((await result.count()) === 0) {
        console.log(chalk.yellow(`        No typeahead row for "${ex.exercise_name}"`));
        await page.keyboard.press("Escape");
        return false;
      }
      await result.click();
      await page.waitForTimeout(700);

      const nSets = Math.max(1, Math.min(10, ex.sets?.length || 3));
      const setSelect = modal.locator("select").first();
      if ((await setSelect.count()) > 0) {
        try {
          await setSelect.selectOption(String(nSets), { timeout: 5000 });
        } catch {
          try {
            await setSelect.selectOption({ label: String(nSets) });
          } catch {
            /* keep default */
          }
        }
      }
      await page.waitForTimeout(500);

      const repsMain = modal.locator(TB_SELECTORS.repsMainInput).first();
      if ((await repsMain.count()) > 0) {
        await repsMain.click();
        await page.keyboard.press(selectAllShortcut());
        await page.keyboard.press("Backspace");
        await repsMain.fill("CUST");
        await page.waitForTimeout(1000);
      }

      let perSet = modal.locator(TB_SELECTORS.customRepSetInputs);
      let nInputs = await perSet.count();
      if (nInputs < nSets) {
        perSet = page.locator(TB_SELECTORS.customRepSetInputs);
        nInputs = await perSet.count();
      }

      for (let s = 0; s < nSets; s++) {
        const val = repsForSet(ex, s);
        if (s < nInputs) {
          await perSet.nth(s).click();
          await page.keyboard.press(selectAllShortcut());
          await perSet.nth(s).fill(val);
        }
      }

      await modal.locator(TB_SELECTORS.addToWorkoutButton).click({ timeout: 10000 });
      await page.waitForTimeout(1500);

      try {
        await page.getByPlaceholder(/Search for Exercise/i).first().waitFor({ state: "hidden", timeout: 8000 });
      } catch {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`        Adding Lift failed: ${msg.slice(0, 120)}`));
      try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  /**
   * Upload a single day's workout to TeamBuildr.
   *
   * Strategy: clear any existing workout on the date, then add exercises
   * one by one with their sets/reps.
   *
   * IMPORTANT: This requires TB_SELECTORS to be configured from a real
   * inspect-teambuilder run. Until then, the function throws immediately.
   */
  async uploadWorkoutForDate(
    calendarDate: string,
    exercises: ExerciseEntry[]
  ): Promise<boolean> {
    assertSelectorsConfigured();
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    console.log(chalk.blue(`    Uploading ${exercises.length} exercises for ${calendarDate}...`));

    // Step 1: Navigate to the date
    const navigated = await this.navigateToDate(calendarDate);
    if (!navigated) return false;

    // Step 2: Clear workout on this date (TeamBuildr uses top-bar "Clear" + often native confirm)
    try {
      page.once("dialog", (d) => d.accept());
      const clearLink = page.locator(TB_SELECTORS.deleteWorkoutButton);
      if ((await clearLink.count()) > 0) {
        await clearLink.click({ timeout: 5000 });
        await page.waitForTimeout(1200);
        console.log(chalk.gray("    Cleared workout (Clear link)"));
      }
    } catch {
      console.log(chalk.gray("    No clear / no dialog — continuing"));
    }

    // Optional HTML confirm (if Clear uses a modal instead of window.confirm)
    try {
      const confirmBtn = page.locator(TB_SELECTORS.confirmDeleteButton).first();
      if ((await confirmBtn.count()) > 0 && (await confirmBtn.isVisible())) {
        await confirmBtn.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    } catch {
      /* no modal */
    }

    // Step 3: Stay on calendar view (exercises already visible after clicking day).
    // Do NOT click "Workouts" — that navigates away from the calendar.
    // "Add Exercise" (green +) is at the bottom of the day's exercise list.

    // Step 4: Add each exercise via "Adding Lift" modal (always use custom reps = CUST)
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i]!;
      const numSets = ex.sets?.length || 3;
      const repPreview = repsForSet(ex, 0);
      console.log(
        chalk.gray(`      ${i + 1}. ${ex.exercise_name} — ${numSets} sets, reps: ${repPreview}…`)
      );

      const ok = await this.addExerciseThroughAddingLiftModal(ex);
      if (!ok) {
        console.log(chalk.yellow(`      Skipped or failed: ${ex.exercise_name}`));
      }
    }

    // Step 5: Save workout (first matching Save link — calendar has two)
    await page.locator(TB_SELECTORS.saveWorkoutButton).first().click();
    await page.waitForTimeout(2000);

    console.log(chalk.green(`    Saved workout for ${calendarDate}`));
    return true;
  }

  /**
   * Re-scrape a date to verify the upload succeeded. Returns the list of
   * exercise names found on the page for that calendar date.
   */
  async verifyDate(calendarDate: string): Promise<string[]> {
    if (!this.page) throw new Error("Browser not initialized");
    const page = this.page;

    await this.navigateToDate(calendarDate);

    const exerciseNames: string[] = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const exerciseKeywords = [
        "squat", "bench", "deadlift", "press", "curl", "row", "pull",
        "extension", "raise", "fly", "dip", "lunge", "leg", "cable",
        "barbell", "dumbbell", "machine", "smith", "hip", "glute",
        "lat", "tricep", "bicep", "shoulder", "chest",
      ];

      return lines.filter((l) =>
        exerciseKeywords.some((kw) => l.toLowerCase().includes(kw))
      );
    });

    return exerciseNames;
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
  }
}

// ============================================================================
// VERIFICATION
// ============================================================================

function verifyUploadedExercises(
  expected: ExerciseEntry[],
  foundOnPage: string[]
): { ok: boolean; matched: number; missing: string[] } {
  let matched = 0;
  const missing: string[] = [];

  for (const ex of expected) {
    const normalised = normalizeExerciseName(ex.exercise_name);
    const found = foundOnPage.some(
      (f) => normalizeExerciseName(f).includes(normalised) ||
             normalised.includes(normalizeExerciseName(f))
    );
    if (found) {
      matched++;
    } else {
      missing.push(ex.exercise_name);
    }
  }

  // Pass if at least 80% of exercises are confirmed on the page
  const threshold = Math.max(1, Math.floor(expected.length * 0.8));
  return { ok: matched >= threshold, matched, missing };
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const program = new Command();
  program
    .option("--live", "Open browser and perform uploads (default: dry-run plan only)")
    .option("--program-id <uuid>", "Upload a single programming_generated row")
    .option("--week-start <YYYY-MM-DD>", "Override the program start week (any date; snapped to Monday)")
    .option("--limit <n>", "Max programs to process", (v) => parseInt(v, 10))
    .option("--mark-uploaded", "After verified upload, set uploaded_to_teambuildr = true", false)
    .option("--reset", "Clear progress file and start fresh", false);

  program.parse();
  const opts = program.opts<{
    live: boolean;
    programId?: string;
    weekStart?: string;
    limit?: number;
    markUploaded: boolean;
    reset: boolean;
  }>();

  const dryRun = !opts.live;
  const tz = CONFIG.gymTimezone;
  const today = todayYmdInTimeZone(tz);

  console.log(chalk.bold("\nSupabase → TeamBuildr upload\n"));
  console.log(chalk.gray(`Gym timezone:  ${tz}`));
  console.log(chalk.gray(`Today (AEST):  ${today}`));
  console.log(chalk.gray(`Mode:          ${dryRun ? "DRY RUN (plan only)" : "LIVE UPLOAD"}`));
  console.log(chalk.gray(`Mark uploaded: ${opts.markUploaded ? "yes" : "no"}\n`));

  if (!dryRun && (!CONFIG.teambuilder.email || !CONFIG.teambuilder.password)) {
    console.error(chalk.red("Set TEAMBUILDER_EMAIL and TEAMBUILDER_PASSWORD in .env"));
    process.exit(1);
  }
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceKey) {
    console.error(chalk.red("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"));
    process.exit(1);
  }

  // Progress tracking (resume support)
  if (opts.reset && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log(chalk.yellow("Progress file cleared.\n"));
  }

  let progress = loadProgress();
  if (!progress) {
    progress = {
      started_at: new Date().toISOString(),
      completed: [],
      failed: [],
      skipped: [],
    };
  }
  const alreadyDone = new Set(progress.completed);

  // Fetch pending programs
  const sb = new SupabaseUpload();
  const allPending = await sb.fetchPendingUploads({
    programId: opts.programId,
    limit: opts.limit,
  });

  // Filter out already-completed (resume)
  const pending = allPending.filter((p) => !alreadyDone.has(p.id));
  if (alreadyDone.size > 0 && pending.length < allPending.length) {
    console.log(
      chalk.gray(`Resuming: ${alreadyDone.size} already done, ${pending.length} remaining`)
    );
  }

  if (pending.length === 0) {
    console.log(chalk.green("No programs pending upload."));
    return;
  }

  console.log(chalk.bold(`${pending.length} program(s) to process\n`));

  // In live mode, launch browser once and reuse across members
  let uploader: TeamBuildrUploader | null = null;
  if (!dryRun) {
    uploader = new TeamBuildrUploader();
    await uploader.init();
    await uploader.login();
  }

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    for (let idx = 0; idx < pending.length; idx++) {
      const p = pending[idx];
      const name = p.member_name || p.member_id;
      const num = alreadyDone.size + idx + 1;
      const total = alreadyDone.size + pending.length;

      console.log(chalk.bold(`\n[${num}/${total}] ${name}`));
      console.log(chalk.gray(`  Program: ${p.id}`));

      try {
        // Resolve anchor Monday: CLI override, then next_due_date (if future), else this week
        let anchorMonday: string;
        if (opts.weekStart) {
          anchorMonday = mondayOfWeekContaining(opts.weekStart);
        } else if (p.next_due_date && compareYmd(p.next_due_date, today) >= 0) {
          anchorMonday = mondayOfWeekContaining(p.next_due_date);
        } else {
          anchorMonday = mondayOfWeekContaining(today);
        }

        console.log(chalk.gray(`  Anchor Monday: ${anchorMonday}   Sessions/week: ${p.sessions_per_week}`));

        // Map sessions to calendar dates
        const mapped = mapSessionsToDates(p, anchorMonday);
        const { uploadable, skippedPast } = filterFutureOrEqualDates(mapped, today);

        for (const row of mapped) {
          const isFuture = compareYmd(row.calendarDate, today) >= 0;
          const tag = isFuture ? chalk.green("upload") : chalk.dim("skip (past)");
          console.log(
            chalk.gray(`    Day ${row.day} → ${row.calendarDate} `) +
              tag +
              chalk.gray(` — ${row.exercises.length} exercises`)
          );
        }

        if (skippedPast.length > 0) {
          console.log(
            chalk.yellow(`  ${skippedPast.length} past date(s) skipped (upload-only rule)`)
          );
        }

        if (uploadable.length === 0) {
          console.log(chalk.yellow("  Nothing to upload: all dates are in the past."));
          progress.skipped.push({
            program_id: p.id,
            member_name: name,
            reason: "all_dates_past",
          });
          skipCount++;
          saveProgress(progress);
          continue;
        }

        if (dryRun) {
          for (const session of uploadable) {
            console.log(chalk.cyan(`\n  ${session.calendarDate} (Day ${session.day}) — ${session.exercises.length} exercises:`));
            for (const ex of session.exercises) {
              const nSets = ex.sets?.length || 0;
              const reps = ex.sets?.map((s) => s.reps).join(", ") || "?";
              const label = ex.series_label ? `[${ex.series_label}]` : "";
              console.log(chalk.gray(`    ${label.padEnd(5)} ${ex.exercise_name}  ${nSets} sets × ${reps}`));
            }
          }

          // --mark-uploaded without --live: admin confirms they uploaded manually
          if (opts.markUploaded) {
            const marked = await sb.markUploaded(p.id);
            if (marked) {
              console.log(chalk.green(`\n  Marked uploaded_to_teambuildr = true`));
              if (p.next_due_date) {
                await sb.updateMemberDueDate(p.member_id, p.next_due_date);
              }
            }
          }

          console.log();
          successCount++;
          continue;
        }

        // ── LIVE MODE ──

        if (!uploader || !p.member_name) {
          throw new Error("member_name missing; cannot search TeamBuildr");
        }

        const found = await uploader.selectMember(p.member_name);
        if (!found) {
          progress.failed.push({
            program_id: p.id,
            member_name: name,
            error: "not_found_in_teambuildr",
          });
          failCount++;
          saveProgress(progress);
          continue;
        }

        // Upload each future date
        let allDatesOk = true;
        for (const session of uploadable) {
          const ok = await uploader.uploadWorkoutForDate(
            session.calendarDate,
            session.exercises
          );
          if (!ok) {
            allDatesOk = false;
            break;
          }
        }

        if (!allDatesOk) {
          progress.failed.push({
            program_id: p.id,
            member_name: name,
            error: "upload_failed_mid_session",
          });
          failCount++;
          saveProgress(progress);
          continue;
        }

        // Verify: re-scrape each uploaded date and check exercise names
        let verificationPassed = true;
        for (const session of uploadable) {
          const foundNames = await uploader.verifyDate(session.calendarDate);
          const result = verifyUploadedExercises(session.exercises, foundNames);
          if (!result.ok) {
            console.log(
              chalk.red(
                `  Verification failed for ${session.calendarDate}: ` +
                  `${result.matched}/${session.exercises.length} matched. ` +
                  `Missing: ${result.missing.join(", ")}`
              )
            );
            verificationPassed = false;
            break;
          }
          console.log(
            chalk.green(
              `  Verified ${session.calendarDate}: ${result.matched}/${session.exercises.length} exercises confirmed`
            )
          );
        }

        if (!verificationPassed) {
          progress.failed.push({
            program_id: p.id,
            member_name: name,
            error: "verification_failed",
          });
          failCount++;
          saveProgress(progress);
          continue;
        }

        // Mark uploaded if flag is set
        if (opts.markUploaded) {
          const marked = await sb.markUploaded(p.id);
          if (marked) {
            console.log(chalk.green("  Marked uploaded_to_teambuildr = true"));
            if (p.next_due_date) {
              await sb.updateMemberDueDate(p.member_id, p.next_due_date);
            }
          } else {
            console.log(chalk.red("  Failed to mark uploaded (Supabase error)"));
          }
        }

        progress.completed.push(p.id);
        successCount++;
        saveProgress(progress);
        console.log(chalk.green(`  Done: ${name}`));
      } catch (err: any) {
        console.error(chalk.red(`  Error: ${err.message || err}`));
        progress.failed.push({
          program_id: p.id,
          member_name: name,
          error: String(err.message || err).slice(0, 200),
        });
        failCount++;
        saveProgress(progress);
      }
    }
  } finally {
    if (uploader) await uploader.close();
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(chalk.bold("\n═══ UPLOAD COMPLETE ═══\n"));
  if (successCount > 0) console.log(chalk.green(`  Success:  ${successCount}`));
  if (failCount > 0) console.log(chalk.red(`  Failed:   ${failCount}`));
  if (skipCount > 0) console.log(chalk.gray(`  Skipped:  ${skipCount}`));
  console.log(chalk.gray(`  Time:     ${elapsed} minutes`));

  if (progress.failed.length > 0) {
    console.log(chalk.yellow("\nFailed programs:"));
    progress.failed.forEach((f) =>
      console.log(chalk.yellow(`  - ${f.member_name}: ${f.error}`))
    );
  }

  if (dryRun && !opts.markUploaded && successCount > 0) {
    console.log(
      chalk.cyan(
        "\nPlan only — upload exercises to TeamBuildr manually, then rerun with " +
          "--mark-uploaded to flag them done.\n"
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
