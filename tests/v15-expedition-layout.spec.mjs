import { test, expect } from '@playwright/test';
test('expedition clean view fills the browser viewport and restores atlas chrome', async ({page})=>{
 await page.setViewportSize({width:874,height:290});
 await page.goto('/atlas/?studio=connective&expedition=1');
 const app=page.locator('#atlas-app'),stage=page.locator('#atlas-stage');
 await expect(app).toHaveAttribute('data-expedition-clean','true');
 await expect(page.locator('.topbar')).toBeHidden();
 await expect(page.locator('#connective-mobile-nav')).toBeHidden();
 await expect(page.locator('#expedition-view')).toBeVisible();
 const bounds=await stage.boundingBox();
 expect(bounds.height).toBeGreaterThanOrEqual(285);expect(bounds.width).toBeGreaterThanOrEqual(870);
 await page.locator('#expedition-view').click();
 await expect(app).toHaveAttribute('data-expedition-clean','false');
 await expect(page.locator('.topbar')).toBeVisible();
 await expect(page.locator('#expedition-toggle')).toHaveAttribute('aria-pressed','true');
 await page.locator('#expedition-view').click();
 await page.locator('#expedition-toggle').click();
 await expect(app).toHaveAttribute('data-expedition-clean','false');
 await expect(page.locator('#expedition-reticle')).toBeHidden();
});

test('diagnostics are opt-in and expose a bounded local report',async({page})=>{await page.goto('/atlas/');await expect(page.locator('#expedition-diagnostics-export')).toHaveCount(0);await page.goto('/atlas/?expedition=1&expeditionDiagnostics=1');await expect(page.locator('#expedition-diagnostics-export')).toBeVisible();const report=await page.evaluate(()=>window.__BODY_EXPEDITION_DIAGNOSTICS__.report());expect(report.schema).toBe('body-live-expedition-diagnostics-1');expect(report.canvas.devicePixelRatio).toBeGreaterThan(0);expect(report.unsupported.gpuFrameTimeMs).toBe('unavailable');expect(report.metrics.activeFrameIntervalMs.samples).toBe(0);});
