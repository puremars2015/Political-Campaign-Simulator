import { expect, test } from '@playwright/test';

test('開局、執行行動、重新整理後可繼續', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '選戰辦公室：距離投票還有90天' })).toBeVisible();

  await page.getByRole('button', { name: '開始新的一局' }).click();
  await expect(page.getByRole('heading', { name: /第 1 回合/ })).toBeVisible();
  await expect(page.getByTestId('action-points')).toHaveText('3');

  await page.getByRole('button', { name: '執行照顧團隊' }).click();
  await expect(page.getByTestId('action-points')).toHaveText('2');

  await page.reload();
  await page.getByRole('button', { name: '繼續遊戲' }).click();
  await expect(page.getByTestId('action-points')).toHaveText('2');

  await page.getByRole('button', { name: '結束本回合' }).click();
  await expect(page.getByRole('heading', { name: /第 2 回合/ })).toBeVisible();
  await expect(page.getByTestId('action-points')).toHaveText('3');
});

test('可只用鍵盤完成行動', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '執行與候選人對焦' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('action-points')).toHaveText('2');
});
