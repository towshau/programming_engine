/**
 * TeamBuilder DOM Inspector
 * 
 * This script opens TeamBuilder in a visible browser, logs in,
 * and gives you time to manually navigate to a member's program.
 * Then it dumps the DOM structure so you can find the right selectors
 * to plug into sync-exercises.ts.
 * 
 * Usage:
 *   npx ts-node inspect-teambuilder.ts
 * 
 * Once the browser opens:
 *   1. Navigate to a member's program manually
 *   2. Press Enter in the terminal when you're on the exercise list page
 *   3. The script will dump relevant DOM info to help find selectors
 */

import { chromium } from "playwright";
import dotenv from "dotenv";
import * as readline from "readline";
import path from "path";
import { Command } from "commander";

// Repo root .env (same as upload-programs), then teambuilder-sync/.env overrides
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function pauseOrWait(label: string, seconds: number): Promise<void> {
  if (seconds > 0) {
    console.log(
      `\n⏱  ${label} — waiting ${seconds}s (navigate now). Omit --auto-seconds for Enter prompts.\n`
    );
    await new Promise((r) => setTimeout(r, seconds * 1000));
    return;
  }
  await waitForEnter(`\n📌 ${label}, then press ENTER here...`);
}

async function pauseBeforeClose(seconds: number, closeAfterDumpSeconds: number): Promise<void> {
  if (seconds > 0) {
    const n = closeAfterDumpSeconds > 0 ? closeAfterDumpSeconds : 15;
    console.log(`\n⏱  Closing browser in ${n}s...\n`);
    await new Promise((r) => setTimeout(r, n * 1000));
    return;
  }
  await waitForEnter("\nPress ENTER to close the browser...");
}

async function main() {
  const cli = new Command();
  cli
    .option(
      "--auto-seconds <n>",
      "Skip Enter: wait N seconds after open (navigate to workout editor), then dump DOM; " +
        "set TEAMBUILDER_INSPECT_CLOSE_SECONDS for delay before browser closes (default 15)",
      undefined
    )
    .parse(process.argv);
  const optSec = cli.opts().autoSeconds;
  const parsedOpt = optSec !== undefined ? parseInt(String(optSec), 10) : NaN;
  const envSec = parseInt(process.env.TEAMBUILDER_INSPECT_AUTO_SECONDS || "", 10);
  let autoSeconds = 0;
  if (optSec !== undefined && !isNaN(parsedOpt) && parsedOpt > 0) {
    autoSeconds = parsedOpt;
  } else if (optSec === undefined && !isNaN(envSec) && envSec > 0) {
    autoSeconds = envSec;
  }
  const closeSec = parseInt(process.env.TEAMBUILDER_INSPECT_CLOSE_SECONDS || "15", 10);

  console.log("\n🔍 TeamBuilder DOM Inspector\n");
  console.log("This will open a browser so you can navigate to the exercise list.");
  console.log("Then it will dump the page structure to help find selectors.\n");
  if (autoSeconds > 0) {
    console.log(`Mode: auto (${autoSeconds}s before dump, ${closeSec}s before close)\n`);
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const page = await browser.newPage();

  // Navigate to TeamBuilder
  const url = process.env.TEAMBUILDER_URL || "https://app.teambuildr.com";
  console.log(`→ Opening ${url}...`);
  await page.goto(url);

  // Try to log in automatically
  const email = process.env.TEAMBUILDER_EMAIL;
  const password = process.env.TEAMBUILDER_PASSWORD;

  if (email && password) {
    console.log("→ Auto-login...");
    try {
      // Accept cookies if banner present
      try {
        const cookieBtn = page.locator('button:has-text("Accept Cookies")');
        await cookieBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      } catch { /* no banner */ }

      await page.waitForSelector('#email-field', { timeout: 10000 });
      await page.fill('#email-field', email);
      await page.click('button:has-text("NEXT")');

      await page.waitForSelector('input[placeholder*="Password" i]', { timeout: 10000 });
      const pwdInput = page.locator('input[placeholder*="Password" i]');
      await pwdInput.click();
      await pwdInput.pressSequentially(password, { delay: 50 });

      const signInBtn = page.locator('button:has-text("SIGN IN")');
      await signInBtn.waitFor({ state: "visible", timeout: 5000 });
      await page.waitForTimeout(500);
      await signInBtn.click();

      await page.waitForFunction(
        () => !window.location.pathname.includes("/login"),
        { timeout: 20000 }
      );
      await page.waitForLoadState("domcontentloaded");
      console.log("→ Logged in, navigating to calendar...");

      await page.goto("https://app.teambuildr.com/calendar", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2000);
    } catch (e: any) {
      console.log(`Auto-login failed: ${e.message?.slice(0, 100)}. Log in manually.`);
    }
  }

  await pauseOrWait(
    "Navigate to a member's calendar, click on a day with a workout, then open the workout editor",
    autoSeconds
  );

  // Dump the exercise page structure
  console.log("\n── Page Structure Analysis ──\n");

  // Get page URL
  console.log(`Current URL: ${page.url()}\n`);

  // Find all tables
  const tables = await page.evaluate(() => {
    const tbls = document.querySelectorAll("table");
    return Array.from(tbls).map((t, i) => ({
      index: i,
      id: t.id,
      className: t.className.substring(0, 80),
      rows: t.rows.length,
      firstRowText: t.rows[0]?.textContent?.trim().substring(0, 100),
    }));
  });

  if (tables.length > 0) {
    console.log(`Tables found: ${tables.length}`);
    tables.forEach((t) => {
      console.log(`  Table #${t.index}: id="${t.id}" class="${t.className}" rows=${t.rows}`);
      console.log(`    First row: "${t.firstRowText}"`);
    });
  }

  // Find list-like containers
  const lists = await page.evaluate(() => {
    // Look for elements that might contain exercise lists
    const candidates = document.querySelectorAll(
      '[class*="exercise"], [class*="workout"], [class*="program"], ' +
      '[data-exercise], [data-workout], ' +
      'ul, ol, .list, .items'
    );

    return Array.from(candidates).slice(0, 20).map((el) => ({
      tag: el.tagName,
      id: el.id,
      className: el.className.toString().substring(0, 100),
      childCount: el.children.length,
      firstChildText: el.children[0]?.textContent?.trim().substring(0, 80),
      dataAttrs: Array.from(el.attributes)
        .filter((a) => a.name.startsWith("data-"))
        .map((a) => `${a.name}="${a.value}"`)
        .join(", "),
    }));
  });

  if (lists.length > 0) {
    console.log(`\nExercise-related elements found: ${lists.length}`);
    lists.forEach((el) => {
      console.log(
        `  <${el.tag.toLowerCase()} id="${el.id}" class="${el.className}" children=${el.childCount} ${el.dataAttrs}>`
      );
      console.log(`    First child text: "${el.firstChildText}"`);
    });
  }

  // Dump all text content that looks like exercise names
  const possibleExercises = await page.evaluate(() => {
    const allText = document.body.innerText;
    const lines = allText.split("\n").filter((l) => l.trim().length > 5 && l.trim().length < 80);
    // Look for lines that might be exercise names (contain common exercise keywords)
    const exerciseKeywords = [
      "squat", "bench", "deadlift", "press", "curl", "row", "pull",
      "extension", "raise", "fly", "dip", "lunge", "leg", "cable",
      "barbell", "dumbbell", "machine", "smith",
    ];
    return lines.filter((l) =>
      exerciseKeywords.some((kw) => l.toLowerCase().includes(kw))
    ).slice(0, 30);
  });

  if (possibleExercises.length > 0) {
    console.log(`\nPossible exercise names found in page text:`);
    possibleExercises.forEach((ex, i) => {
      console.log(`  ${i + 1}. "${ex.trim()}"`);
    });
  }

  // ── All buttons on the page ──
  const allButtons = await page.evaluate(() => {
    const els = document.querySelectorAll(
      'button, a.btn, [role="button"], input[type="button"], input[type="submit"], ' +
      '[class*="btn"], [class*="button"], [onclick]'
    );
    return Array.from(els).slice(0, 80).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id,
        className: el.className.toString().substring(0, 120),
        text: el.textContent?.trim().substring(0, 80),
        title: el.getAttribute("title") || "",
        ariaLabel: el.getAttribute("aria-label") || "",
        href: (el as HTMLAnchorElement).href || "",
        onclick: el.getAttribute("onclick")?.substring(0, 120) || "",
        visible: rect.width > 0 && rect.height > 0,
        dataAttrs: Array.from(el.attributes)
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => `${a.name}="${a.value?.substring(0, 60)}"`)
          .join(", "),
      };
    });
  });

  console.log(`\n── Buttons / clickable elements (${allButtons.length}) ──\n`);
  allButtons.filter(b => b.visible).forEach((b) => {
    const label = b.text || b.title || b.ariaLabel || "(no text)";
    const extra = [
      b.id ? `id="${b.id}"` : "",
      b.className ? `class="${b.className.substring(0, 60)}"` : "",
      b.onclick ? `onclick="${b.onclick.substring(0, 60)}"` : "",
      b.dataAttrs || "",
    ].filter(Boolean).join(" ");
    console.log(`  <${b.tag.toLowerCase()}> ${label}  ${extra}`);
  });

  // ── All inputs on the page ──
  const allInputs = await page.evaluate(() => {
    const els = document.querySelectorAll(
      "input, textarea, select, [contenteditable='true']"
    );
    return Array.from(els).slice(0, 60).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        type: (el as HTMLInputElement).type || "",
        id: el.id,
        name: (el as HTMLInputElement).name || "",
        placeholder: (el as HTMLInputElement).placeholder || "",
        className: el.className.toString().substring(0, 100),
        value: (el as HTMLInputElement).value?.substring(0, 40) || "",
        visible: rect.width > 0 && rect.height > 0,
        dataAttrs: Array.from(el.attributes)
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => `${a.name}="${a.value?.substring(0, 60)}"`)
          .join(", "),
      };
    });
  });

  console.log(`\n── Inputs / fields (${allInputs.length}) ──\n`);
  allInputs.filter(i => i.visible).forEach((inp) => {
    const label = inp.placeholder || inp.name || inp.id || "(no label)";
    const extra = [
      inp.id ? `id="${inp.id}"` : "",
      inp.name ? `name="${inp.name}"` : "",
      inp.className ? `class="${inp.className.substring(0, 60)}"` : "",
      inp.value ? `value="${inp.value}"` : "",
      inp.dataAttrs || "",
    ].filter(Boolean).join(" ");
    console.log(`  <${inp.tag.toLowerCase()} type="${inp.type}"> ${label}  ${extra}`);
  });

  // ── Modals / overlays ──
  const modals = await page.evaluate(() => {
    const candidates = document.querySelectorAll(
      '.modal, [class*="modal"], [class*="overlay"], [class*="dialog"], ' +
      '[role="dialog"], [class*="popup"], [class*="sidebar"]'
    );
    return Array.from(candidates).slice(0, 15).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id,
        className: el.className.toString().substring(0, 120),
        visible: rect.width > 0 && rect.height > 0,
        childCount: el.children.length,
        textPreview: el.textContent?.trim().substring(0, 200),
      };
    });
  });

  const visibleModals = modals.filter(m => m.visible);
  if (visibleModals.length > 0) {
    console.log(`\n── Visible modals/overlays (${visibleModals.length}) ──\n`);
    visibleModals.forEach((m) => {
      console.log(`  <${m.tag.toLowerCase()} id="${m.id}" class="${m.className}" children=${m.childCount}>`);
      console.log(`    text: "${m.textPreview}"`);
    });
  }

  await pauseBeforeClose(autoSeconds, closeSec);
  await browser.close();
  console.log("Done.");
}

main();
