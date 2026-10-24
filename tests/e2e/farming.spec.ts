import { expect, test } from "@playwright/test";

test.describe("Sunny Acres", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("completes a crop cycle, an animal cycle, and persists progress", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sunny Acres" })).toBeVisible();

    await page.getByRole("button", { name: /Buy Wheat seed/ }).click();
    await page.getByRole("button", { name: /^Plant Plot 1/ }).click();
    await page.getByRole("button", { name: /^Water Plot 1/ }).click();
    await page.evaluate(() => window.__SUNNY_ACRES__?.advance(21_000));
    await page.getByRole("button", { name: /^Harvest Plot 1/ }).click();
    await page.getByRole("button", { name: /Sell one Wheat/ }).click();

    await page.getByRole("button", { name: /Buy Goat/ }).click();
    await page.getByRole("button", { name: /Feed Goat/ }).click();
    await page.evaluate(() => window.__SUNNY_ACRES__?.advance(61_000));
    await page.getByRole("button", { name: /Collect milk from Goat/ }).click();
    await page.getByRole("button", { name: /Sell one Goat milk/ }).click();

    await page.getByRole("button", { name: /Buy Cat/ }).click();
    await page.getByRole("button", { name: /Feed Cat/ }).click();
    await page.getByRole("button", { name: /Pet Cat/ }).click();

    await expect(page.locator(".wallet")).toContainText("13");

    const beforeReload = await page.evaluate(() => window.__SUNNY_ACRES__?.getState());
    expect(beforeReload?.animals).toHaveLength(2);
    expect(beforeReload?.inventory.wheat).toBe(1);

    await page.reload();
    const afterReload = await page.evaluate(() => window.__SUNNY_ACRES__?.getState());
    expect(afterReload?.coins).toBe(13);
    expect(afterReload?.animals).toHaveLength(2);
    expect(afterReload?.inventory.wheat).toBe(1);
  });

  test("supports keyboard activation and a mobile viewport without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const plotButton = page.getByRole("button", { name: /^Plant Plot 1/ });
    await plotButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Water Plot 1/ })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
  });

  test("shows a recovery message when the save is corrupt", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("sunny-acres:save", "{broken"));
    await page.goto("/");

    await expect(page.locator(".message-banner")).toContainText("could not be loaded");
    const backup = await page.evaluate(() =>
      Object.keys(window.localStorage).some((key) => key.startsWith("sunny-acres:save-backup-"))
    );
    expect(backup).toBe(true);
  });
});
