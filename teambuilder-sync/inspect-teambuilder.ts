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

async function main() {
  console.log("\n🔍 TeamBuilder DOM Inspector\n");
  console.log("This will open a browser so you can navigate to the exercise list.");
  console.log("Then it will dump the page structure to help find selectors.\n");

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
    console.log("→ Attempting auto-login...\n");

    try {
      // Dump the login page structure first
      const loginInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll("input");
        return Array.from(inputs).map((el) => ({
          type: el.type,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder,
          className: el.className.substring(0, 80),
        }));
      });

      console.log("Login page inputs found:");
      loginInputs.forEach((input) => {
        console.log(`  <input type="${input.type}" name="${input.name}" id="${input.id}" placeholder="${input.placeholder}">`);
      });

      const buttons = await page.evaluate(() => {
        const btns = document.querySelectorAll("button, input[type='submit']");
        return Array.from(btns).map((el) => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 50),
          type: (el as HTMLButtonElement).type,
          id: el.id,
          className: el.className.substring(0, 80),
        }));
      });

      console.log("\nLogin page buttons found:");
      buttons.forEach((btn) => {
        console.log(`  <${btn.tag.toLowerCase()} type="${btn.type}" id="${btn.id}">${btn.text}</${btn.tag.toLowerCase()}>`);
      });

    } catch (e) {
      console.log("Could not auto-detect login form. Please log in manually.");
    }
  }

  // Wait for user to navigate to the right page
  await waitForEnter(
    "\n📌 Log in and navigate to a member's exercise list, then press ENTER here..."
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

  // Wait before closing
  await waitForEnter("\nPress ENTER to close the browser...");
  await browser.close();
  console.log("Done.");
}

main();
