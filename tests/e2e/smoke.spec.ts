import { expect, test } from '@playwright/test';

// e2e 建置使用 tests/fixtures/content-data.ts 的測試專用資料

async function startAsCandidateA(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).click();
  await expect(page.getByRole('heading', { name: '選擇縣市' })).toBeVisible();
  await page.getByRole('button', { name: /測試市（測試資料）/ }).click();
  await expect(page.getByRole('heading', { name: '選擇要輔佐的候選人' })).toBeVisible();
  await page.getByRole('button', { name: '查看測試候選人甲的資料' }).click();
  await expect(page.getByRole('heading', { name: '測試候選人甲' })).toBeVisible();
  await page.getByRole('button', { name: '確認輔佐並開始' }).click();
  await expect(page.getByRole('heading', { name: /第 1 回合/ })).toBeVisible();
}

test('選縣市、選候選人、確認後開局，重新整理可繼續', async ({ page }) => {
  await startAsCandidateA(page);
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

test('確認頁可查閱我方與對手政見的原文來源', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).click();
  await page.getByRole('button', { name: /測試市（測試資料）/ }).click();
  await page.getByRole('button', { name: '查看測試候選人甲的資料' }).click();

  await expect(page.getByRole('heading', { name: /同選區對手：測試候選人乙/ })).toBeVisible();
  await expect(page.getByText('來源未說明').first()).toBeVisible();
  await page.getByText('查看原文與來源').first().click();
  await expect(page.getByRole('link', { name: '測試候選人甲政見' }).first()).toBeVisible();
});

test('未完成的縣市只能查看進度，返回會清除候選人選擇', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).click();
  await page.getByRole('button', { name: /未完成市（測試資料）/ }).click();
  await expect(page.getByRole('heading', { name: '此縣市尚不可玩' })).toBeVisible();
  await expect(page.getByText('尚未建立候選人名單').first()).toBeVisible();
  await page.getByRole('button', { name: '返回選擇縣市' }).click();
  await expect(page.getByRole('heading', { name: '選擇縣市' })).toBeVisible();
});

test('政見策略室：大張旗鼓與圓滑包裝只改變宣傳安排', async ({ page }) => {
  await startAsCandidateA(page);
  await expect(page.getByRole('heading', { name: '政見策略室' })).toBeVisible();
  await expect(page.getByText('風險：沒有寫明規模、時程或經費，容易被說空泛').first()).toBeVisible();

  await page.getByRole('button', { name: '大張旗鼓：交通' }).click();
  await expect(page.getByTestId('action-points')).toHaveText('2');
  await expect(page.getByText(/交通政見：待宣傳 → 大張旗鼓（主打）/)).toBeVisible();

  const housing = page.locator('.strategy').filter({ hasText: '測試政見：興建社會住宅' }).first();
  await housing.getByLabel('包裝角度').selectOption({ label: '承認限制、說明步驟' });
  await housing.getByRole('button', { name: '圓滑包裝：住宅' }).click();
  await expect(page.getByText(/住宅政見：待宣傳 → 圓滑包裝（承認限制、說明步驟）/)).toBeVisible();
  // 政見原文不變
  await expect(page.getByText('測試政見：興建社會住宅').first()).toBeVisible();
});

test('可只用鍵盤完成開局與行動', async ({ page }) => {
  await page.goto('/');
  for (const name of ['開始新的一局', /測試市（測試資料）/, '查看測試候選人甲的資料', '確認輔佐並開始']) {
    await page.getByRole('button', { name }).focus();
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '執行與候選人對焦' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('action-points')).toHaveText('2');
});


test('預覽縣市標示預覽資料，只能輔佐收錄範圍內的候選人', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).click();
  await expect(page.getByRole('button', { name: /預覽市（測試資料）.*預覽可玩/ })).toBeVisible();
  await page.getByRole('button', { name: /預覽市（測試資料）/ }).click();
  await expect(page.getByRole('heading', { name: '預覽資料' })).toBeVisible();
  await expect(page.getByText('不在本預覽的收錄範圍，尚無法輔佐；這不代表候選人沒有主張。')).toBeVisible();

  await page.getByRole('button', { name: '查看預覽候選人三的資料' }).click();
  await expect(page.getByRole('button', { name: '確認輔佐並開始' })).toBeDisabled();
  await page.getByRole('button', { name: '返回候選人名單' }).click();

  await page.getByRole('button', { name: '查看預覽候選人一的資料' }).click();
  await page.getByRole('button', { name: '確認輔佐並開始' }).click();
  await expect(page.getByText(/預覽資料（名單未公告、來源待審閱）/)).toBeVisible();
  await expect(page.getByRole('button', { name: '大張旗鼓：交通' })).toBeVisible();
});

test('事件：處理完才能結束回合，選項顯示已知代價', async ({ page }) => {
  await startAsCandidateA(page);
  await page.getByRole('button', { name: '結束本回合' }).click();
  await expect(page.getByRole('heading', { name: '測試事件' })).toBeVisible();
  await expect(page.getByText('本回合事件・模擬情境')).toBeVisible();
  await expect(page.getByRole('button', { name: '結束本回合' })).toBeDisabled();
  await expect(page.getByText('已知代價：經費')).toBeVisible();

  await page.getByRole('button', { name: '零成本選項' }).click();
  await expect(page.getByRole('heading', { name: '測試事件' })).toHaveCount(0);
  await expect(page.getByText(/測試事件：零成本選項/)).toBeVisible();

  // 第 3 回合：綁定真實政見的交鋒事件
  await page.getByRole('button', { name: '結束本回合' }).click();
  await expect(page.getByRole('heading', { name: '兩邊政見交鋒' })).toBeVisible();
  await expect(page.getByText('我方相關政見')).toBeVisible();
  await expect(page.getByText(/對手相關政見：測試候選人乙/)).toBeVisible();
  await page.getByRole('button', { name: '正面對比' }).click();
  await expect(page.getByText(/目前處理：圓滑包裝（與對手對比）/)).toBeVisible();
});
