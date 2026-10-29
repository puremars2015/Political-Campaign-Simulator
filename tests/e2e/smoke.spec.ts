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

test('主打政見只改變宣傳安排', async ({ page }) => {
  await startAsCandidateA(page);
  await page.getByRole('button', { name: '設為主打：交通' }).click();
  await expect(page.getByTestId('action-points')).toHaveText('2');
  await expect(page.getByText('測試政見：增加公車班次').first()).toBeVisible();
  await expect(page.getByText(/政見宣傳安排：待宣傳 → 主打/)).toBeVisible();
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

test('政見盲測：遮住身分作答後開票', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始新的一局' }).click();
  await page.getByRole('button', { name: /測試市（測試資料）/ }).click();
  await page.getByRole('button', { name: '開始政見盲測' }).click();
  await expect(page.getByText(/測試候選人丙 尚未列入/)).toBeVisible();
  await page.getByRole('button', { name: '開始比政見' }).click();

  // 作答時看不到候選人姓名
  for (let round = 0; round < 3; round++) {
    await expect(page.getByText(/第 \d／3 輪/)).toBeVisible();
    await expect(page.getByText('測試候選人甲')).toHaveCount(0);
    await expect(page.getByText('測試候選人乙')).toHaveCount(0);
    if (round === 0) await page.getByRole('button', { name: '跳過這一輪' }).click();
    else await page.getByRole('button', { name: '蓋章：第 1 段' }).click();
  }

  await expect(page.getByRole('heading', { name: '哪些議題對你特別重要？' })).toBeVisible();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: '開票' }).click();
  await expect(page.getByRole('heading', { name: '你蓋章的政見是誰提出的' })).toBeVisible();
  await expect(page.getByText(/測試候選人甲（測試黨）：\d 分/)).toBeVisible();
  await expect(page.getByText('你蓋章的段落', { exact: false }).first()).toBeVisible();
});
