import { expect, test, type Page } from '@playwright/test';
const cities = [
  ['臺北市','沈伯洋','蔣萬安'],['新北市','李四川','蘇巧慧'],['桃園市','張善政','黃世杰'],
  ['臺中市','江啟臣','何欣純'],['臺南市','謝龍介','陳亭妃'],['高雄市','柯志恩','賴瑞隆'],
];
async function setup(page: Page, city: string, name: string) {
  await page.clock.setFixedTime(new Date('2026-10-30T03:00:00Z'));
  await page.goto('/');
  await page.getByRole('button',{name:'開始新的一局'}).click();
  await expect(page.getByRole('button',{name:/預覽可玩/})).toHaveCount(6);
  await page.getByRole('button',{name:new RegExp(city)}).click();
  await expect(page.getByRole('button',{name:/查看.*的資料/})).toHaveCount(2);
  await page.getByRole('button',{name:`查看${name}的資料`}).click();
  await page.getByRole('button',{name:'確認輔佐並開始'}).click();
}
async function finish(page: Page, from = 1) {
  for (let round = from; round <= 12; round++) {
    await expect(page.getByRole('heading',{name:new RegExp(`第 ${round} 回合：`)})).toBeVisible();
    const choices = page.locator('.choices button:not(:disabled)');
    if (await choices.count()) await choices.last().click();
    await page.getByText('選用：安排行動',{exact:true}).click();
    const action = page.getByRole('button',{name:'執行與候選人對焦'});
    if (await action.isEnabled()) await action.click();
    await page.getByText('選用：安排行動',{exact:true}).click();
    await page.getByRole('button',{name:'結束本回合'}).click();
  }
  await expect(page.getByRole('heading',{name:'選前之夜'})).toBeVisible();
}
for (const [city, ...names] of cities) for (const name of names) {
  test(`${city} ${name} 正式內容完整一局、選前夜收尾、存讀與重玩`, async ({page}, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await setup(page,city!,name!);
    await finish(page);
    const ending = await page.locator('main').innerText();
    await expect(page.locator('table')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await page.getByRole('button',{name:'繼續遊戲'}).click();
    expect(await page.locator('main').innerText()).toBe(ending);
    if (city === '臺北市' && name === '沈伯洋') {
      await page.screenshot({path:`test-results/evidence/v1-eve-${info.project.name}.png`,fullPage:true});
      await page.getByRole('button',{name:'相同日期與種子重新挑戰'}).click();
      await finish(page);
      expect(await page.locator('main').innerText()).toBe(ending);
    }
    await page.getByRole('button',{name:'重新選擇縣市與候選人'}).click();
    await expect(page.getByRole('heading',{name:'選擇縣市'})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test('新聞失效與localStorage停用仍可遊玩',async({page}) => {
  await page.route('**/news.json',route=>route.abort());
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled');}}));
  await setup(page,'新北市','李四川');
  await expect(page.getByRole('status')).toContainText('尚未保存');
  await finish(page);
});

test('選前第十天、九天、前一夜與選後歷史重玩介面',async({page}) => {
  for (const [date, visible] of [['2026-11-18',true],['2026-11-19',false],['2026-11-27',false]] as const) {
    await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`));
    await page.goto('/');
    await page.getByRole('button',{name:'開始新的一局'}).click();
    await page.getByRole('button',{name:/新北市/}).click();
    await page.getByRole('button',{name:'查看李四川的資料'}).click();
    await page.getByRole('button',{name:'確認輔佐並開始'}).click();
    expect(await page.getByText(/模擬民調觀測・/).count()).toBe(visible ? 1 : 0);
    if (date === '2026-11-27') {
      const choices=page.locator('.choices button:not(:disabled)');
      await choices.last().click();
      await page.getByRole('button',{name:'結束本回合'}).click();
      await expect(page.getByRole('heading',{name:'選前之夜'})).toBeVisible();
      await expect(page.getByText(/模擬民調觀測・/)).toHaveCount(0);
    }
  }
  await page.clock.setFixedTime(new Date('2026-11-29T03:00:00Z'));
  await page.goto('/');
  await page.getByRole('button',{name:'開始新的一局'}).click();
  await page.getByRole('button',{name:/新北市/}).click();
  await page.getByRole('button',{name:'查看李四川的資料'}).click();
  await expect(page.getByRole('button',{name:'確認輔佐並開始'})).toBeDisabled();
  await expect(page.getByText(/本屆劇本已結束/)).toBeVisible();
  await page.getByRole('button',{name:'歷史重玩：2026-11-16 起'}).click();
  await expect(page.getByText(/本局日期基準 2026-11-16/)).toBeVisible();
});
