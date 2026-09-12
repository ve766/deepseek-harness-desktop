// P4-2 Showcase capture (v0.1 视觉样本库). Drives the full scripted showcase:
//   S1 welcome (Demo action) -> enter canvas -> Space demo (Nox thinking->done)
//   -> S4 Nox Navigator panel -> S5 AI status -> click "view growth galaxy"
//   -> S3 Growth demo -> click "exit demo" -> restore.
// Six surfaces (S1-S5 + exit) x bilingual (zh-CN/en-US) x 3 themes
// (light/dark/reduced) => ~28 showcase-* screenshots.
//
// This is a DEV-ONLY capture artifact. It requires the esbuild bundle served at
// http://localhost:8099/ (see build.cjs) and Playwright-core + Edge headless.
// Dev-only ?kcuDemo / ?kcuEmpty hooks in mock/bootstrap.ts land the right states.
const fs = require('fs')
const path = require('path')
const { chromium } = require(
  'F:/deepseek-harness-dsh-v0.1.0-rc.7/deepseek-harness-dsh-v0.1.0-rc.7/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core',
)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8099/'
const OUT = 'C:/Users/Hasee/WorkBuddy/2026-08-25-14-56-36/outputs'
fs.mkdirSync(OUT, { recursive: true })

const themes = [
  { tag: 'zh-light', lang: 'zh-CN', theme: 'light', reduced: false },
  { tag: 'en-light', lang: 'en-US', theme: 'light', reduced: false },
  { tag: 'zh-dark', lang: 'zh-CN', theme: 'dark', reduced: false },
  { tag: 'zh-reduced', lang: 'zh-CN', theme: 'light', reduced: true },
]

const cjk = (s) => /[一-鿿]/.test(s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const clickCta = (page, kw) =>
  page.evaluate((k) => {
    const btn = [...document.querySelectorAll('.cta')].find((b) =>
      (b.textContent || '').includes(k),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  }, kw)

const hasCta = (page, kw) =>
  page.evaluate((k) => {
    return [...document.querySelectorAll('.cta')].some((b) => (b.textContent || '').includes(k))
  }, kw)

const themeAttrOf = (page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'))

// Reduced-motion compliance: under prefers-reduced-motion, no element in the
// capture path should be running an animation or a non-zero transition.
const motionOffFor = (page) =>
  page.evaluate(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!mq) return 'n/a'
    const sels = ['.gnode', '.cta', '.wd__enter', '.wd-card', '.appbtn', '.pill', '.knode', '.nox-card__cta', '.lptrack', '.command-center', '.home', '.nav-rail']
    const bad = []
    for (const s of sels) {
      const el = document.querySelector(s)
      if (!el) continue
      const cs = getComputedStyle(el)
      const anim = cs.animationName === 'none' || cs.animationName === ''
      const trans = cs.transitionDuration === '0s' || cs.transitionDuration === ''
      if (!anim || !trans) bad.push(s)
    }
    return bad.length ? bad.join(',') : 'ok'
  })

// D1 复验：Nox 面板(.assoc)背景在 light 下不应再是硬编码暗色 rgb(28,28,30)。
const noxBgOf = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.assoc') || document.querySelector('.insight')
    if (!el) return null
    return getComputedStyle(el).backgroundColor
  })

// CJK-leak check = UI chrome only (per P4-2 验收规则调整).
// Knowledge content — mock knowledge nodes, imported documents, user-generated
// content, knowledge-graph titles — is intentionally language-agnostic and
// EXCLUDED. Knowledge OS is a multilingual knowledge container; Chinese knowledge
// assets must be allowed to coexist with an English UI. We scan body text with
// .knode / .gnode (knowledge-graph titles) AND .sks__lens / .sks__inspector
// (employee contributor names = language-agnostic proper nouns) removed. The
// Shared Knowledge Space header / graph-legend chrome is still scanned, so a
// genuine untranslated chrome string would still be caught.
const cjkLeakOf = async (page, lang) => {
  if (lang !== 'en-US') return false
  const txt = await page.evaluate(() => {
    const clone = document.body.cloneNode(true)
    clone
      .querySelectorAll('.knode, .gnode, .sks__lens, .sks__inspector, .sks__contrib-row')
      .forEach((n) => n.remove())
    return clone.innerText || ''
  })
  return [...txt].some((ch) => cjk(ch))
}

// C1: scoped CJK-leak check — only the Employee Identity Unit region. Other P3
// sections (Welcome demo, morphicon grid) may legitimately carry Chinese in the
// zh frame; this guards the unit itself so the en frame stays CJK-free.
const cjkLeakEmployee = async (page, lang) => {
  if (lang !== 'en-US') return false
  const txt = await page.evaluate(() => {
    const region = [...document.querySelectorAll('.p3-region')].find((s) => s.querySelector('.employee-card'))
    return region ? region.innerText || '' : ''
  })
  return [...txt].some((ch) => cjk(ch))
}

const initScript = (th) => ({ l: th.lang, theme: th.theme })

// P4-2 hotfix gate: floating canvas controls must never overlap one another,
// and CTA buttons must not spill outside their own box. A clipped .cta__label
// is NOT a failure — `text-overflow: ellipsis` is the intended truncation
// (acceptance: "button labels show in full OR are correctly truncated").
const overlayCheck = (page) =>
  page.evaluate(() => {
    const sels = ['.modeswitch', '.toolbar', '.canvas-actions', '.zoom-readout']
    const rects = {}
    for (const s of sels) {
      const el = document.querySelector(s)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.width && r.height) rects[s] = r
    }
    const overlaps = []
    const keys = Object.keys(rects)
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = rects[keys[i]]
        const b = rects[keys[j]]
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ox > 2 && oy > 2) overlaps.push(keys[i] + '|' + keys[j])
      }
    }
    const ctaSpill = []
    document.querySelectorAll('.cta').forEach((el, i) => {
      if (el.scrollWidth > el.clientWidth + 1) ctaSpill.push('btn' + i)
      const lb = el.querySelector('.cta__label')
      if (lb && lb.scrollWidth > lb.clientWidth + 1 && getComputedStyle(lb).textOverflow !== 'ellipsis')
        ctaSpill.push('label' + i)
    })
    return { overlaps, ctaSpill }
  })

const makeCtx = async (browser, th, vp) => {
  const ctx = await browser.newContext({
    viewport: vp || { width: 1280, height: 900 },
    reducedMotion: th.reduced ? 'reduce' : 'no-preference',
    colorScheme: th.theme === 'dark' ? 'dark' : 'light',
  })
  const page = await ctx.newPage()
  // Intercept the browser's automatic favicon.ico request (this prototype ships
  // no favicon asset) and fulfill it locally, so it never produces a 404 +
  // "Failed to load resource" console error. This is environmental noise, not an
  // app defect, and the racy console/response pairing below is a secondary guard.
  await page.route('**/favicon.ico', (route) =>
    route.fulfill({ status: 200, contentType: 'image/x-icon', body: '' }),
  )
  const errors = []
  const fourohfour = []
  // favicon.ico has no real asset in this prototype; its 404 is an environmental
  // artifact, not an app defect. Track it so we can suppress the matching console
  // error (the response listener already excludes it from `fourohfour`).
  const favicon404 = { n: 0 }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text()
      if (/Failed to load resource/i.test(t) && favicon404.n > 0) {
        favicon404.n--
        return
      }
      errors.push('console:' + t)
    }
  })
  page.on('response', (r) => {
    if (r.status() === 404) {
      if (/favicon\.ico$/.test(r.url())) {
        favicon404.n++
        return
      }
      fourohfour.push(r.url())
    }
  })
  await page.addInitScript(
    ({ l, theme }) => {
      try {
        localStorage.setItem(
          'kcu.language.v1',
          JSON.stringify({
            interfaceLanguage: l,
            aiLanguage: 'system',
            locale: l,
            timezone: 'Asia/Shanghai',
            dateFormat: 'system',
            numberFormat: 'us',
          }),
        )
        localStorage.setItem('kcu-theme', theme)
        localStorage.setItem('kcu-firstrun', 'done')
      } catch (e) {}
    },
    initScript(th),
  )
  return { ctx, page, errors, fourohfour }
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const results = []

  for (const th of themes) {
    const kw =
      th.lang === 'en-US'
        ? { start: 'Explore the demo library', growth: 'View growth galaxy', exit: 'Exit demo' }
        : { start: '体验示例知识库', growth: '查看成长星系', exit: '退出示例' }

    // ---------- S1: Welcome Dashboard ----------
    {
      const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
      await page.goto(BASE + '?kcuEmpty=welcome', { waitUntil: 'networkidle' })
      await sleep(1200)
      const hasWelcomeEmpty = !!(await page.$('.emptystate--welcome'))
      const actionText = await page.evaluate(
        () => document.querySelector('.emptystate__action')?.textContent || '',
      )
      const actionHasDemo = actionText.includes(kw.start)
      const shot = `showcase-welcome-${th.tag}.png`
      await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })
      const cjkLeak = await cjkLeakOf(page, th.lang)
      const themeAttr = await themeAttrOf(page)
      const motionOff = await motionOffFor(page)
      results.push({
        surface: 'welcome',
        tag: th.tag,
        shot,
        hasWelcomeEmpty,
        actionHasDemo,
        cjkLeak,
        theme: th.theme,
        themeAttr,
        motionOff,
        errors: errors.length,
        fourohfour,
      })
      await ctx.close()
    }

    // ---------- S2/S4/S5 + Growth + Exit (one canvas session) ----------
    {
      const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
      await page.goto(BASE + '?kcuDemo=1', { waitUntil: 'networkidle' })
      await sleep(700)
      const entered = await page.evaluate(() => {
        const btn = document.querySelector('.wd__enter')
        if (btn) {
          btn.click()
          return true
        }
        return false
      })
      if (!entered) errors.push('no-welcome-enter-btn')
      await sleep(1000)

      // --- S2 (thinking) + S5 (AI status) captured during Nox thinking ---
      const thinking = !!(await page.$('.insight__thinking'))
      const shotThink = `showcase-space-thinking-${th.tag}.png`
      await page.screenshot({ path: `${OUT}/${shotThink}`, fullPage: true })
      // S5: AI status = ThinkingRing / insight thinking block.
      const aiEl = await page.$('.insight__thinking')
      const aiStatusPresent = !!aiEl
      if (aiEl) {
        await aiEl.screenshot({ path: `${OUT}/showcase-ai-status-${th.tag}.png` })
      }
      const aiMotionOff = await motionOffFor(page)
      const aiCjk = await cjkLeakOf(page, th.lang)
      results.push({
        surface: 'ai-status',
        tag: th.tag,
        shot: `showcase-ai-status-${th.tag}.png`,
        aiStatusPresent,
        cjkLeak: aiCjk,
        theme: th.theme,
        motionOff: aiMotionOff,
        errors: errors.length,
        fourohfour,
      })
      await sleep(3500) // let runImportDemo reach done (~3.4s)

      // --- S2 (done) ---
      const spaceNodeCount = await page.evaluate(
        () => document.querySelectorAll('.knode__head').length,
      )
      const hasGrowthCta = await hasCta(page, kw.growth)
      const spaceNoEmpty = !(await page.$('.emptystate'))
      const shotSpace = `showcase-space-done-${th.tag}.png`
      await page.screenshot({ path: `${OUT}/${shotSpace}`, fullPage: true })
      const spaceThemeAttr = await themeAttrOf(page)
      const spaceMotionOff = await motionOffFor(page)
      const spaceCjk = await cjkLeakOf(page, th.lang)
      const spaceOverlay = await overlayCheck(page)
      results.push({
        surface: 'space',
        tag: th.tag,
        shot: shotSpace,
        entered,
        thinking,
        spaceNodeCount,
        hasGrowthCta,
        spaceNoEmpty,
        cjkLeak: spaceCjk,
        theme: th.theme,
        themeAttr: spaceThemeAttr,
        motionOff: spaceMotionOff,
        overlaps: spaceOverlay.overlaps,
        ctaSpill: spaceOverlay.ctaSpill,
        errors: errors.length,
        fourohfour,
      })

      // --- S4: Nox Navigator (AIInsightPanel / AssociationExplainer) ---
      const noxEl = await page.$('.insight')
      const noxPresent = !!noxEl
      if (noxEl) {
        await noxEl.screenshot({ path: `${OUT}/showcase-nox-navigator-${th.tag}.png` })
      }
      // D1 复验：light 下 .assoc 背景不应是硬编码暗色 rgb(28,28,30)。
      const noxBg = await noxBgOf(page)
      const noxThemeAdaptive = !(th.theme === 'light' && noxBg === 'rgb(28, 28, 30)')
      const noxCjk = await cjkLeakOf(page, th.lang)
      results.push({
        surface: 'nox-navigator',
        tag: th.tag,
        shot: `showcase-nox-navigator-${th.tag}.png`,
        noxPresent,
        noxBg,
        noxThemeAdaptive,
        cjkLeak: noxCjk,
        errors: errors.length,
        fourohfour,
      })

      // --- S3: Growth Galaxy ---
      const clickedGrowth = await clickCta(page, kw.growth)
      if (!clickedGrowth) errors.push('no-growth-cta-' + th.tag)
      await sleep(1000)
      const galaxyNodeCount = await page.evaluate(
        () => document.querySelectorAll('.gnode__head').length,
      )
      const hasExitCta = await hasCta(page, kw.exit)
      const shotGrowth = `showcase-growth-${th.tag}.png`
      await page.screenshot({ path: `${OUT}/${shotGrowth}`, fullPage: true })
      const growthCjk = await cjkLeakOf(page, th.lang)
      results.push({
        surface: 'growth',
        tag: th.tag,
        shot: shotGrowth,
        galaxyNodeCount,
        hasExitCta,
        cjkLeak: growthCjk,
        errors: errors.length,
        fourohfour,
      })

      // --- Exit demo: restore ---
      const clickedExit = await clickCta(page, kw.exit)
      if (!clickedExit) errors.push('no-exit-cta-' + th.tag)
      await sleep(1000)
      const residue = await page.evaluate(() => {
        const t = document.body.innerText || ''
        return ['AI 员工计划', '产品演示录屏', '竞品分析报告', 'Q3 产品规划.pdf'].some((s) =>
          t.includes(s),
        )
      })
      const restoredNodes = await page.evaluate(
        () => document.querySelectorAll('.knode__head').length,
      )
      const exitNoDemoCta = !(await hasCta(page, kw.exit))
      const exitNoEmpty = !(await page.$('.emptystate'))
      const shotExit = `showcase-exit-${th.tag}.png`
      await page.screenshot({ path: `${OUT}/${shotExit}`, fullPage: true })
      results.push({
        surface: 'exit',
        tag: th.tag,
        shot: shotExit,
        noResidue: !residue,
        restoredNodes,
        exitNoDemoCta,
        exitNoEmpty,
        errors: errors.length,
        fourohfour,
      })
      await ctx.close()
    }
  }

  // ---------- P4-2 hotfix: narrow-viewport pass (assertion only) ----------
  // Layout geometry is theme-independent, so only the two languages are run at
  // the shell's own 1040px breakpoint. No screenshots here — the 28-shot
  // matrix already covers the visual surfaces; this pass guards geometry.
  for (const lang of ['zh-CN', 'en-US']) {
    const th = { tag: 'narrow-' + lang, lang, theme: 'light', reduced: false }
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th, { width: 1040, height: 800 })
    await page.goto(BASE + '?kcuDemo=1', { waitUntil: 'networkidle' })
    await sleep(700)
    await page.evaluate(() => document.querySelector('.wd__enter')?.click())
    await sleep(4200)
    const spaceOverlay = await overlayCheck(page)
    // Growth galaxy reuses the same floating chrome — assert it too.
    await clickCta(page, lang === 'en-US' ? 'View growth galaxy' : '查看成长星系')
    await sleep(1000)
    const growthOverlay = await overlayCheck(page)
    results.push({
      surface: 'narrow',
      tag: th.tag,
      overlaps: spaceOverlay.overlaps.concat(growthOverlay.overlaps.map((o) => 'growth:' + o)),
      ctaSpill: spaceOverlay.ctaSpill.concat(growthOverlay.ctaSpill),
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- C1: Employee Card surface (P3 showcase @ p3.html) ----------
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const cardCount = await page.evaluate(() => document.querySelectorAll('.employee-card').length)
    // avatar fallback = CSS placeholder tiles (knowledge + task have no PNG)
    const placeholderCount = await page.evaluate(
      () => document.querySelectorAll('.employee-icon--fallback').length,
    )
    const shot = `showcase-employee-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })
    const cjkLeak = await cjkLeakEmployee(page, th.lang)
    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)
    // offline status must be present in the 5x5 status grid
    const offlineCovered = await page.evaluate(
      () => !!document.querySelector('[data-status="offline"]'),
    )
    // long name/role must be TRIMMED (ellipsis), not spilling the card box
    const longTrimmed = await page.evaluate(() => {
      let anyTrimmed = false
      document
        .querySelectorAll('.employee-card__name, .employee-card__role')
        .forEach((el) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow === 'ellipsis')
            anyTrimmed = true
        })
      return anyTrimmed
    })
    // overflow: no .employee-card may spill its own box; labels may ellipsize.
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.employee-card').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('card' + i)
      })
      document
        .querySelectorAll('.employee-card__name, .employee-card__role')
        .forEach((el, i) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis')
            bad.push('txt' + i)
        })
      return bad
    })
    results.push({
      surface: 'employee',
      tag: th.tag,
      shot,
      cardCount,
      placeholderCount,
      overflow,
      offlineCovered,
      longTrimmed,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- B: AI Command Center surface (P3 showcase @ p3.html) ----------
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const floatingCount = await page.evaluate(
      () => document.querySelectorAll('[data-cc-fixture="floating"] .command-center').length,
    )
    const dockedCount = await page.evaluate(
      () => document.querySelectorAll('[data-cc-fixture="docked"] .command-center').length,
    )
    const shot = `showcase-command-center-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    // single glass layer: shell translucent + blur, no descendant re-glassed
    const singleGlass = await page.evaluate(() => {
      const shell = document.querySelector('.command-center')
      if (!shell) return 'no-shell'
      const cs = getComputedStyle(shell)
      const bgOk = (() => {
        const m = cs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return false
        const nums = m[0].match(/[\d.]+/g).map(Number)
        const a = nums.length === 4 ? nums[3] : 1
        return a < 1 // translucent => glass
      })()
      const blurOk = /blur\(/.test(cs.backdropFilter) || /blur\(/.test(cs.webkitBackdropFilter)
      let secondGlass = 0
      shell.querySelectorAll('*').forEach((el) => {
        const ecs = getComputedStyle(el)
        if (/blur\(/.test(ecs.backdropFilter) || /blur\(/.test(ecs.webkitBackdropFilter)) secondGlass++
      })
      return bgOk && blurOk && secondGlass === 0 ? 'ok' : `bg=${bgOk} blur=${blurOk} second=${secondGlass}`
    })

    // scoped CJK-leak: command-center region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const region = [...document.querySelectorAll('.p3-region')].find((s) =>
          s.querySelector('.command-center'),
        )
        return region ? region.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // overflow: shell + action/system/label rows must not spill; labels ellipsize
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.command-center').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document
        .querySelectorAll('.cc-action__label, .cc-system__label, .cc-project__name, .cc-task__title')
        .forEach((el, i) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
        })
      return bad
    })

    // action grading: at least one primary + at least one context present
    const graded = await page.evaluate(() => ({
      primary: document.querySelectorAll('.cc-action--primary').length,
      context: document.querySelectorAll('.cc-action--context').length,
    }))

    // docked fixture exercises the empty-task branch
    const emptyTaskCovered = await page.evaluate(() => {
      const docked = document.querySelector('[data-cc-fixture="docked"]')
      return !!(docked && docked.querySelector('.cc-empty'))
    })

    results.push({
      surface: 'command-center',
      tag: th.tag,
      shot,
      floatingCount,
      dockedCount,
      singleGlass,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      overflow,
      gradedPrimary: graded.primary,
      gradedContext: graded.context,
      emptyTaskCovered,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- B: command-center narrow (docked, 560px) — geometry guard ----------
  for (const lang of ['zh-CN', 'en-US']) {
    const th = { tag: 'cc-narrow-' + lang, lang, theme: 'light', reduced: false }
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th, { width: 560, height: 900 })
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.command-center').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document.querySelectorAll('.cc-action__label, .cc-system__label').forEach((el, i) => {
        const cs = getComputedStyle(el)
        if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
      })
      return bad
    })
    results.push({
      surface: 'command-center-narrow',
      tag: th.tag,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- A: AI Employee Home surface (P3 showcase @ p3.html) ----------
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const shot = `showcase-home-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    const homePresent = await page.evaluate(() => document.querySelectorAll('.home').length)
    const dockTiles = await page.evaluate(() => document.querySelectorAll('.home-dock__tile').length)
    const dockActive = await page.evaluate(() => document.querySelectorAll('.home-dock__tile.is-active').length)
    const dockOffline = await page.evaluate(() => document.querySelectorAll('.home-dock__tile.is-offline').length)
    const dockNotify = await page.evaluate(() => document.querySelectorAll('.home-dock__badge').length)
    const heroPresent = await page.evaluate(() => document.querySelectorAll('.home__primary .employee-card--hero').length)

    // A2: one-sentence status narrative (AI Employee Status Narrative), NOT a task list
    const taskReadoutPresent = await page.evaluate(
      () => document.querySelectorAll('.home__narrative').length,
    )
    // A2: quick actions — entry points, graded primary/context (no toolbar)
    const quickActionsPresent = await page.evaluate(
      () => document.querySelectorAll('.home__actions .home-action').length,
    )
    const primaryActions = await page.evaluate(
      () => document.querySelectorAll('.home__actions .home-action--primary').length,
    )
    const contextActions = await page.evaluate(
      () => document.querySelectorAll('.home__actions .home-action--context').length,
    )

    // single glass layer: Dock is glass; nothing inside it is re-glassed
    const singleGlass = await page.evaluate(() => {
      const shell = document.querySelector('.home-dock')
      if (!shell) return 'no-shell'
      const cs = getComputedStyle(shell)
      const bgOk = (() => {
        const m = cs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return false
        const nums = m[0].match(/[\d.]+/g).map(Number)
        const a = nums.length === 4 ? nums[3] : 1
        return a < 1
      })()
      const blurOk = /blur\(/.test(cs.backdropFilter) || /blur\(/.test(cs.webkitBackdropFilter)
      let secondGlass = 0
      shell.querySelectorAll('*').forEach((el) => {
        const ecs = getComputedStyle(el)
        if (/blur\(/.test(ecs.backdropFilter) || /blur\(/.test(ecs.webkitBackdropFilter)) secondGlass++
      })
      return bgOk && blurOk && secondGlass === 0 ? 'ok' : `bg=${bgOk} blur=${blurOk} second=${secondGlass}`
    })

    // scoped CJK-leak: .home region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.home')
        return el ? el.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // overflow: shells + labels must not spill; labels ellipsize
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.home, .home-dock').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document
        .querySelectorAll('.home__title, .home-dock__label, .employee-card__name, .employee-card__role')
        .forEach((el, i) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
        })
      return bad
    })

    results.push({
      surface: 'home',
      tag: th.tag,
      shot,
      homePresent,
      dockTiles,
      dockActive,
      dockOffline,
      dockNotify,
      heroPresent,
      taskReadoutPresent,
      quickActionsPresent,
      primaryActions,
      contextActions,
      singleGlass,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- A: home narrow (560px) — geometry guard ----------
  for (const lang of ['zh-CN', 'en-US']) {
    const th = { tag: 'home-narrow-' + lang, lang, theme: 'light', reduced: false }
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th, { width: 560, height: 900 })
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.home, .home-dock').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document.querySelectorAll('.employee-card__name, .employee-card__role').forEach((el, i) => {
        const cs = getComputedStyle(el)
        if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
      })
      return bad
    })
    results.push({
      surface: 'home-narrow',
      tag: th.tag,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- A3: Navigation Rail surface (P3 showcase @ p3.html) ----------
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    await page.evaluate(() => {
      const el = document.querySelector('[data-rail-fixture="default"]')
      if (el) el.scrollIntoView()
    })
    await sleep(300)
    const shot = `showcase-navigation-rail-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    const railItems = await page.evaluate(
      () => document.querySelectorAll('.nav-rail__item').length,
    )
    const railActive = await page.evaluate(
      () => document.querySelectorAll('.nav-rail__item--active').length,
    )
    const railMarketplaceDisabled = await page.evaluate(
      () => document.querySelectorAll('.nav-rail__item--disabled').length,
    )
    const railCCInvoke = await page.evaluate(
      () => document.querySelectorAll('.nav-rail__cc').length,
    )

    // single glass layer: rail is FLAT (opaque, no backdrop-filter)
    const singleGlass = await page.evaluate(() => {
      const shell = document.querySelector('.nav-rail')
      if (!shell) return 'no-shell'
      const cs = getComputedStyle(shell)
      const bgOk = (() => {
        const m = cs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return true // no bg => treat as opaque (flat)
        const nums = m[0].match(/[\d.]+/g).map(Number)
        const a = nums.length === 4 ? nums[3] : 1
        return a >= 1
      })()
      const blurOk = !/blur\(/.test(cs.backdropFilter) && !/blur\(/.test(cs.webkitBackdropFilter)
      return bgOk && blurOk ? 'ok' : `bg=${bgOk} blur=${blurOk}`
    })

    // scoped CJK-leak: .nav-rail region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.nav-rail')
        return el ? el.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // overflow: rail shell + items must not spill; labels ellipsize
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.nav-rail').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document.querySelectorAll('.nav-rail__item, .nav-rail__cc').forEach((el, i) => {
        const cs = getComputedStyle(el)
        if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis')
          bad.push('txt' + i)
      })
      return bad
    })

    results.push({
      surface: 'navigation-rail',
      tag: th.tag,
      shot,
      railItems,
      railActive,
      railMarketplaceDisabled,
      railCCInvoke,
      singleGlass,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- A3: navigation-rail narrow (560px) — geometry guard ----------
  for (const lang of ['zh-CN', 'en-US']) {
    const th = { tag: 'rail-narrow-' + lang, lang, theme: 'light', reduced: false }
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th, { width: 560, height: 900 })
    await page.goto(BASE + 'p3.html', { waitUntil: 'networkidle' })
    await sleep(1200)
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.nav-rail').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      return bad
    })
    results.push({
      surface: 'navigation-rail-narrow',
      tag: th.tag,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- SHELL INTEGRATION: real App Shell surface (index.html) ----------
  // Verifies the Navigation Rail replaced SideNav in the REAL app tree, the
  // single-glass discipline holds, Home mounts, and CommandCenter opens/closes
  // via the Shell-controlled ccOpen state (role=dialog + Esc).
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE, { waitUntil: 'networkidle' }) // index.html = real app
    await sleep(1200)

    const railPresent = await page.evaluate(() => document.querySelectorAll('.nav-rail').length)
    // sidebarAbsent is a 1/0 flag: 1 = legacy SideNav (.sidebar) correctly removed
    // from the real app tree (replaced by NavigationRail); 0 = .sidebar leak.
    const sidebarCount = await page.evaluate(() => document.querySelectorAll('.sidebar').length)
    const sidebarAbsent = sidebarCount === 0 ? 1 : 0

    const gridFirstCol = await page.evaluate(() => {
      const s = document.querySelector('.shell')
      if (!s) return null
      const cols = getComputedStyle(s).gridTemplateColumns.split(' ').map((x) => x.trim())
      return cols[0] || null
    })
    const gridFirstColOk = !!gridFirstCol && gridFirstCol.startsWith('72px')

    // single glass + titlebar glass check (in one pass)
    const glass = await page.evaluate(() => {
      const rail = document.querySelector('.nav-rail')
      if (!rail) return { railGlass: false, railBlur: true, railBg: false, glassCount: 0, tbBlur: false, railHasBlur: true }
      const rcs = getComputedStyle(rail)
      const railBlur = /blur\(/.test(rcs.backdropFilter) || /blur\(/.test(rcs.webkitBackdropFilter)
      const railBg = (() => {
        const m = rcs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return true
        const n = m[0].match(/[\d.]+/g).map(Number)
        const a = n.length === 4 ? n[3] : 1
        return a >= 1
      })()
      const railGlass = railBg && !railBlur
      let glassCount = 0
      document.querySelectorAll('.shell *').forEach((el) => {
        const cs = getComputedStyle(el)
        if (/blur\(/.test(cs.backdropFilter) || /blur\(/.test(cs.webkitBackdropFilter)) glassCount++
      })
      const tb = document.querySelector('.titlebar')
      const tbBlur = tb
        ? /blur\(/.test(getComputedStyle(tb).backdropFilter) || /blur\(/.test(getComputedStyle(tb).webkitBackdropFilter)
        : false
      return { railGlass, railBlur, railBg, glassCount, tbBlur, railHasBlur: railBlur }
    })
    const railSingleGlass = glass.railGlass ? 'ok' : `bg=${glass.railBg} blur=${glass.railBlur}`
    // TitleBar is sanctioned system-chrome glass; the only violation is if the
    // Rail itself became glass (double-blur) or glass layers exceed 2.
    const titleBarGlassIssue = glass.railHasBlur || glass.glassCount > 2

    const employeesEntryKept = await page.evaluate(
      () => document.querySelectorAll('.nav-rail__item[data-route="employees"]').length,
    )

    // scoped CJK-leak: .nav-rail region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.nav-rail')
        return el ? el.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // --- home mount: click Rail home item → .home present ---
    await page.evaluate(() => document.querySelector('.nav-rail__item[data-route="home"]')?.click())
    await sleep(400)
    const homeMount = await page.evaluate(() => document.querySelectorAll('.home').length)

    // --- CC invoke: click Rail CC affordance → overlay + command-center present ---
    await page.evaluate(() => document.querySelector('.nav-rail__cc')?.click())
    await sleep(400)
    const ccMountOnInvoke = await page.evaluate(
      () =>
        document.querySelectorAll('.command-center-overlay').length === 1 &&
        document.querySelectorAll('.command-center').length >= 1,
    )
    const ccDialogAttrs = await page.evaluate(() => {
      const d = document.querySelector('.command-center-overlay__panel')
      if (!d) return null
      return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal') }
    })

    // --- CC close on Esc ---
    await page.keyboard.press('Escape')
    await sleep(400)
    const ccCloseOnEsc = await page.evaluate(
      () => document.querySelectorAll('.command-center-overlay').length === 0,
    )

    const shot = `showcase-shell-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    results.push({
      surface: 'shell',
      tag: th.tag,
      shot,
      railPresent,
      sidebarAbsent,
      gridFirstCol,
      gridFirstColOk,
      railSingleGlass,
      titleBarGlassIssue,
      shellGlassCount: glass.glassCount,
      titleBarBlur: glass.tbBlur,
      employeesEntryKept,
      homeMount,
      ccMountOnInvoke,
      ccDialogAttrs,
      ccCloseOnEsc,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- SHELL INTEGRATION: real Employee Center surface (index.html) ----------
  // Stage 2-A: verifies the employees route renders <EmployeeCenter> (real shell, not
  // a placeholder), 4 roster cards + switch entries, single-glass discipline, scoped
  // CJK-free in en frame, no overflow, active marker, and that the switch entry
  // navigates back to Home (D1: Center selects, Home shows presence).
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE, { waitUntil: 'networkidle' }) // index.html = real app
    await sleep(1200)

    // go to employees route via the Rail
    await page.evaluate(() => document.querySelector('.nav-rail__item[data-route="employees"]')?.click())
    await sleep(400)

    const centerMount = await page.evaluate(() => document.querySelectorAll('.employee-center').length)
    const cardCount = await page.evaluate(() => document.querySelectorAll('.employee-center__card').length)
    const openCount = await page.evaluate(() => document.querySelectorAll('.employee-center__open').length)
    const activeMarker = await page.evaluate(() => document.querySelectorAll('.employee-center__card.is-active').length)

    // single glass layer: the EmployeeCenter surface is transparent (flat, no blur).
    const singleGlass = await page.evaluate(() => {
      const root = document.querySelector('.employee-center')
      if (!root) return 'no-root'
      const cs = getComputedStyle(root)
      const bgOk = (() => {
        const m = cs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return true // no bg declared => treat as flat
        const n = m[0].match(/[\d.]+/g).map(Number)
        const a = n.length === 4 ? n[3] : 1
        // opaque (a>=1) OR fully transparent (a===0) => flat, no frosted glass.
        // only a translucent 0<a<1 background would be a real glass layer.
        return a === 0 || a >= 1
      })()
      const blurOk = !/blur\(/.test(cs.backdropFilter) && !/blur\(/.test(cs.webkitBackdropFilter)
      let secondGlass = 0
      root.querySelectorAll('*').forEach((el) => {
        const ecs = getComputedStyle(el)
        if (/blur\(/.test(ecs.backdropFilter) || /blur\(/.test(ecs.webkitBackdropFilter)) secondGlass++
      })
      return bgOk && blurOk && secondGlass === 0 ? 'ok' : `bg=${bgOk} blur=${blurOk} second=${secondGlass}`
    })

    // scoped CJK-leak: .employee-center region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.employee-center')
        return el ? el.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // overflow: surface shell + cards + identity labels must not spill; labels ellipsize
    const overflow = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('.employee-center, .employee-center__card').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('shell' + i)
      })
      document
        .querySelectorAll('.employee-card__name, .employee-card__role')
        .forEach((el, i) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
        })
      return bad
    })

    const shot = `showcase-shell-employee-center-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    // D1: switch entry navigates to Home (Center selects, Home shows presence)
    await page.evaluate(() => document.querySelector('.employee-center__open[data-employee-id="assistant"]')?.click())
    await sleep(500)
    const switchNavigatesToHome = await page.evaluate(
      () => document.querySelectorAll('.employee-center').length === 0 && document.querySelectorAll('.home').length === 1,
    )

    results.push({
      surface: 'shell-employee-center',
      tag: th.tag,
      shot,
      centerMount,
      cardCount,
      openCount,
      activeMarker,
      singleGlass,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      switchNavigatesToHome,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- SHELL INTEGRATION: real Employee Detail surface (Stage 3 drill-down) ----------
  // Verifies the employees-route drill-down renders <EmployeeDetail> (not an overlay),
  // with hero + capability overview + level + growth timeline, single-glass discipline,
  // scoped CJK-free in en frame, no overflow, and a working back entry.
  for (const th of themes) {
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
    await page.goto(BASE, { waitUntil: 'networkidle' }) // index.html = real app
    await sleep(1200)

    // go to employees route via the Rail
    await page.evaluate(() => document.querySelector('.nav-rail__item[data-route="employees"]')?.click())
    await sleep(400)
    // open the drill-down detail for one roster card (D1: stays on employees route)
    await page.evaluate(() => document.querySelector('.employee-center__detail[data-employee-id="assistant"]')?.click())
    await sleep(400)

    const detailMount = await page.evaluate(() => document.querySelectorAll('.employee-detail').length)
    const detailBack = await page.evaluate(() => document.querySelectorAll('[data-employee-back]').length)
    const detailCapabilities = await page.evaluate(() => (document.querySelectorAll('[data-employee-detail-caps]').length >= 1 ? 1 : 0))
    const detailLevel = await page.evaluate(() => (document.querySelectorAll('[data-employee-detail-level]').length >= 1 ? 1 : 0))
    const detailGrowth = await page.evaluate(() => (document.querySelectorAll('[data-employee-detail-growth]').length >= 1 ? 1 : 0))

    // single glass layer: the EmployeeDetail surface is transparent (flat, no blur).
    const singleGlass = await page.evaluate(() => {
      const root = document.querySelector('.employee-detail')
      if (!root) return 'no-root'
      const cs = getComputedStyle(root)
      const bgOk = (() => {
        const m = cs.backgroundColor.match(/rgba?\([^)]+\)/)
        if (!m) return true // no bg declared => treat as flat
        const n = m[0].match(/[\d.]+/g).map(Number)
        const a = n.length === 4 ? n[3] : 1
        // opaque (a>=1) OR fully transparent (a===0) => flat, no frosted glass.
        // only a translucent 0<a<1 background would be a real glass layer.
        return a === 0 || a >= 1
      })()
      const blurOk = !/blur\(/.test(cs.backdropFilter) && !/blur\(/.test(cs.webkitBackdropFilter)
      let secondGlass = 0
      root.querySelectorAll('*').forEach((el) => {
        const ecs = getComputedStyle(el)
        if (/blur\(/.test(ecs.backdropFilter) || /blur\(/.test(ecs.webkitBackdropFilter)) secondGlass++
      })
      return bgOk && blurOk && secondGlass === 0 ? 'ok' : `bg=${bgOk} blur=${blurOk} second=${secondGlass}`
    })

    // scoped CJK-leak: .employee-detail region only, en frame must be CJK-free
    const cjkLeak = await (async () => {
      if (th.lang !== 'en-US') return false
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.employee-detail')
        return el ? el.innerText || '' : ''
      })
      return [...txt].some((ch) => cjk(ch))
    })()

    const themeAttr = await themeAttrOf(page)
    const motionOff = await motionOffFor(page)

    // overflow: surface shell + panels + identity labels must not spill; labels ellipsize
    const overflow = await page.evaluate(() => {
      const bad = []
      document
        .querySelectorAll('.employee-detail, .employee-detail__panel, .employee-detail__hero')
        .forEach((el, i) => {
          if (el.scrollWidth > el.clientWidth + 2) bad.push('detail' + i)
        })
      document
        .querySelectorAll('.employee-card__name, .employee-card__role, .employee-detail__milestone-phase, .employee-detail__milestone-detail')
        .forEach((el, i) => {
          const cs = getComputedStyle(el)
          if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') bad.push('txt' + i)
        })
      return bad
    })

    const shot = `showcase-shell-employee-detail-${th.tag}.png`
    await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true })

    results.push({
      surface: 'shell-employee-detail',
      tag: th.tag,
      shot,
      detailMount,
      detailBack,
      detailCapabilities,
      detailLevel,
      detailGrowth,
      singleGlass,
      cjkLeak,
      theme: th.theme,
      themeAttr,
      motionOff,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- SHELL INTEGRATION: narrow real shell (560px) — geometry guard ----------
  for (const lang of ['zh-CN', 'en-US']) {
    const th = { tag: 'shell-narrow-' + lang, lang, theme: 'light', reduced: false }
    const { ctx, page, errors, fourohfour } = await makeCtx(browser, th, { width: 560, height: 900 })
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await sleep(1000)
    const overflow = await page.evaluate(() => {
      const bad = []
      // no horizontal page overflow
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
        bad.push('page-x-overflow')
      document.querySelectorAll('.nav-rail').forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 2) bad.push('rail' + i)
      })
      // insight hidden at narrow → no leftover 320px column overflow
      const ins = document.querySelector('.insight')
      if (ins && getComputedStyle(ins).display !== 'none' && ins.scrollWidth > ins.clientWidth + 2)
        bad.push('insight')
      return bad
    })
    results.push({
      surface: 'shell-narrow',
      tag: th.tag,
      overflow,
      errors: errors.length,
      fourohfour,
    })
    await ctx.close()
  }

  // ---------- STAGE 4: Shared Knowledge Universe — architecture seam probe ----------
  // Verifies (runtime + static) the seam is mounted without polluting any surface,
  // the singleton identity holds, the employee lens is read-only, and the concrete
  // backend is only ever referenced through the KnowledgeBackend interface (no
  // canvasStore coupling, no knowledge fields leaked into employee types).
  {
    // --- static (Node-side) seam integrity checks ---
    const kSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'knowledge', 'knowledgeUniverse.ts'), 'utf8')
    const tSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'types.ts'), 'utf8')
    const ecSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'EmployeeCenter.tsx'), 'utf8')
    const edSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'EmployeeDetail.tsx'), 'utf8')

    // knowledgeUniverseSeam: file exists + exports both seam functions
    const knowledgeUniverseSeam =
      kSrc.includes('export function getSharedUniverse') &&
      (kSrc.includes('export function bindEmployee') || kSrc.includes('export async function bindEmployee'))

    // kgIntegrationReserved: NOT importing canvasStore (strip comments first, so
    // the explanatory comment in the module — which mentions canvasStore by name —
    // does not trip the check); only wired to the KnowledgeBackend interface + the
    // single allowed concrete impl (MockBackend).
    const kSrcNoComments = kSrc.replace(/\/\/.*$/gm, '')
    const kgIntegrationReserved =
      !!kSrc &&
      !/canvasStore/.test(kSrcNoComments) &&
      /from '..\/mock\/mockBackend'/.test(kSrc) &&
      /from '..\/types'/.test(kSrc)

    // employeeTypesUnpolluted: AgentProfile has no knowledge field, and the seam
    // is not imported into either employee surface (no leakage into employee types).
    const agentProfileBlock = (tSrc.match(/export interface AgentProfile \{[\s\S]*?\n\}/) || [''])[0]
    const agentProfileClean = !/knowledge|universe|lens/i.test(agentProfileBlock)
    const employeeTypesUnpolluted =
      agentProfileClean && !/knowledgeUniverse/.test(ecSrc) && !/knowledgeUniverse/.test(edSrc)

    for (const th of themes) {
      const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
      await page.goto(BASE, { waitUntil: 'networkidle' }) // index.html = real app
      await sleep(800)

      const seam = await page.evaluate(async () => {
        const u = window.__kcuKnowledgeUniverse
        if (!u) return { present: false }
        const a = u.getSharedUniverse()
        const b = u.getSharedUniverse()
        const lens = await u.bindEmployee('assistant')
        return {
          present: true,
          singleton: a === b,
          lensCanWrite: lens.canWrite,
          lensAgentId: lens.agentId,
        }
      })

      const railItems = await page.evaluate(
        () => document.querySelectorAll('.nav-rail__item').length,
      )

      results.push({
        surface: 'shell-knowledge-seam',
        tag: th.tag,
        knowledgeUniverseSeam: knowledgeUniverseSeam ? 1 : 0,
        sharedUniverseSingleton: seam.present && seam.singleton ? 1 : 0,
        employeeLensReadonly: seam.present && seam.lensCanWrite === false ? 1 : 0,
        noNewRailItem: railItems === 7 ? 1 : 0,
        kgIntegrationReserved: kgIntegrationReserved ? 1 : 0,
        employeeTypesUnpolluted: employeeTypesUnpolluted ? 1 : 0,
        seamPresent: seam.present ? 1 : 0,
        errors: errors.length,
        fourohfour,
      })
      await ctx.close()
    }
  }

  // ---------- STAGE 5: Shared Knowledge Space — knowledge-graph visualization ----------
  // Verifies the knowledge route is promoted to a real Shared Knowledge Space that
  // wraps (does NOT rewrite) the canvas and adds a read-only knowledge-graph layer
  // (node/edge/relationship/source/contributor) + an employee read-only lens. Also
  // asserts the NEW sharedBackendIdentity (D2): canvasStore.backend === getSharedUniverse().
  {
    for (const th of themes) {
      const { ctx, page, errors, fourohfour } = await makeCtx(browser, th)
      await page.goto(BASE, { waitUntil: 'networkidle' }) // index.html = real app (default route = knowledge)
      try {
        await page.waitForSelector('.sks', { timeout: 6000 })
      } catch (e) {
        /* sksPresent will be 0 below */
      }
      await sleep(400)

      const probe = await page.evaluate(async () => {
        const sks = document.querySelector('.sks')
        const graphLayer = document.querySelector('.sks__graph-layer')
        const legendRows = document.querySelectorAll('.sks__legend-row').length
        const inspector = document.querySelector('.sks__inspector')
        const lensItems = document.querySelectorAll('.sks__lens-item')
        const canvasHost = document.querySelector('.sks__canvas')
        const railItems = document.querySelectorAll('.nav-rail__item').length
        // D2: canvas store and the employee lens MUST share ONE backend instance.
        const u = window.__kcuKnowledgeUniverse
        const s = window.__kcuStore
        const sharedBackendIdentity = !!(u && s && s.backend === u.getSharedUniverse())
        // D4: clicking an employee lens highlights (selects) their contributed nodes.
        // Read-only highlight — no private space, no knowledge mutation.
        let selectionAfterClick = -1
        if (lensItems.length) {
          lensItems[0].click()
          selectionAfterClick = s.getState().selection.size
        }
        // D5: the space carries Knowledge ONLY — it does not embed the command center.
        const readonlySpace = !document.querySelector('.sks .command-center')
        return {
          sksPresent: !!sks,
          graphLayerPresent: !!graphLayer && legendRows >= 1,
          inspectorPresent: !!inspector,
          lensCount: lensItems.length,
          canvasReused: !!canvasHost,
          railItems,
          sharedBackendIdentity: sharedBackendIdentity ? 1 : 0,
          selectionAfterClick,
          readonlySpace: readonlySpace ? 1 : 0,
        }
      })

      results.push({
        surface: 'shell-knowledge-space',
        tag: th.tag,
        sksPresent: probe.sksPresent ? 1 : 0,
        graphLayerPresent: probe.graphLayerPresent ? 1 : 0,
        inspectorPresent: probe.inspectorPresent ? 1 : 0,
        lensPresent: probe.lensCount >= 1 ? 1 : 0,
        canvasReused: probe.canvasReused ? 1 : 0,
        noNewRailItem: probe.railItems === 7 ? 1 : 0,
        sharedBackendIdentity: probe.sharedBackendIdentity,
        lensHighlightWorks: probe.selectionAfterClick > 0 ? 1 : 0,
        readonlySpace: probe.readonlySpace,
        errors: errors.length,
        fourohfour,
      })
      await ctx.close()
    }
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
  const motionOk = (r) => r.motionOff === 'ok' || r.motionOff === 'n/a'
  const ok = results.every((r) => {
    if (r.errors !== 0 || (r.fourohfour && r.fourohfour.length)) return false
    if (r.surface === 'welcome')
      return r.hasWelcomeEmpty && r.actionHasDemo && !r.cjkLeak && r.themeAttr === r.theme && motionOk(r)
    if (r.surface === 'space')
      return (
        r.entered &&
        r.spaceNodeCount > 0 &&
        r.hasGrowthCta &&
        r.spaceNoEmpty &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.overlaps.length === 0 &&
        r.ctaSpill.length === 0
      )
    if (r.surface === 'ai-status') return r.aiStatusPresent && !r.cjkLeak && motionOk(r)
    if (r.surface === 'nox-navigator') return r.noxPresent && r.noxThemeAdaptive && !r.cjkLeak
    if (r.surface === 'growth') return r.galaxyNodeCount > 0 && r.hasExitCta && !r.cjkLeak
    if (r.surface === 'exit') return r.noResidue && r.restoredNodes > 0 && r.exitNoDemoCta && r.exitNoEmpty
    if (r.surface === 'narrow') return r.overlaps.length === 0 && r.ctaSpill.length === 0
    if (r.surface === 'employee')
      return (
        r.cardCount > 0 &&
        r.placeholderCount >= 2 &&
        r.overflow.length === 0 &&
        r.offlineCovered &&
        r.longTrimmed &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r)
      )
    if (r.surface === 'command-center')
      return (
        r.floatingCount === 1 &&
        r.dockedCount === 1 &&
        r.singleGlass === 'ok' &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.overflow.length === 0 &&
        r.gradedPrimary >= 1 &&
        r.gradedContext >= 1 &&
        r.emptyTaskCovered
      )
    if (r.surface === 'command-center-narrow')
      return r.overflow.length === 0 && r.errors === 0 && (!r.fourohfour || r.fourohfour.length === 0)
    if (r.surface === 'home')
      return (
        r.homePresent === 1 &&
        r.dockTiles === 4 &&
        r.dockActive === 1 &&
        r.dockOffline >= 1 &&
        r.dockNotify >= 1 &&
        r.heroPresent === 1 &&
        // A2: status narrative (not a task list) + graded quick actions
        r.taskReadoutPresent >= 1 &&
        r.quickActionsPresent >= 1 &&
        r.primaryActions >= 1 &&
        r.contextActions >= 1 &&
        r.singleGlass === 'ok' &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.overflow.length === 0
      )
    if (r.surface === 'home-narrow')
      return r.overflow.length === 0
    if (r.surface === 'navigation-rail')
      return (
        r.railItems === 7 &&
        r.railActive === 1 &&
        r.railMarketplaceDisabled === 1 &&
        r.railCCInvoke === 1 &&
        r.singleGlass === 'ok' &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.overflow.length === 0
      )
    if (r.surface === 'navigation-rail-narrow')
      return r.overflow.length === 0 && r.errors === 0 && (!r.fourohfour || r.fourohfour.length === 0)
    if (r.surface === 'shell')
      return (
        r.railPresent === 1 &&
        r.sidebarAbsent === 1 &&
        r.gridFirstColOk &&
        r.railSingleGlass === 'ok' &&
        !r.titleBarGlassIssue &&
        r.employeesEntryKept === 1 &&
        r.homeMount === 1 &&
        r.ccMountOnInvoke &&
        r.ccCloseOnEsc &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.errors === 0 &&
        (!r.fourohfour || r.fourohfour.length === 0)
      )
    if (r.surface === 'shell-employee-center')
      return (
        r.centerMount === 1 &&
        r.cardCount === 4 &&
        r.openCount === 4 &&
        r.activeMarker === 1 &&
        r.singleGlass === 'ok' &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.switchNavigatesToHome &&
        r.overflow.length === 0 &&
        r.errors === 0 &&
        (!r.fourohfour || r.fourohfour.length === 0)
      )
    if (r.surface === 'shell-employee-detail')
      return (
        r.detailMount === 1 &&
        r.detailBack === 1 &&
        r.detailCapabilities === 1 &&
        r.detailLevel === 1 &&
        r.detailGrowth === 1 &&
        r.singleGlass === 'ok' &&
        !r.cjkLeak &&
        r.themeAttr === r.theme &&
        motionOk(r) &&
        r.overflow.length === 0 &&
        r.errors === 0 &&
        (!r.fourohfour || r.fourohfour.length === 0)
      )
    if (r.surface === 'shell-narrow')
      return r.overflow.length === 0 && r.errors === 0 && (!r.fourohfour || r.fourohfour.length === 0)
    if (r.surface === 'shell-knowledge-seam')
      return (
        r.knowledgeUniverseSeam === 1 &&
        r.sharedUniverseSingleton === 1 &&
        r.employeeLensReadonly === 1 &&
        r.noNewRailItem === 1 &&
        r.kgIntegrationReserved === 1 &&
        r.employeeTypesUnpolluted === 1 &&
        r.seamPresent === 1 &&
        r.errors === 0 &&
        (!r.fourohfour || r.fourohfour.length === 0)
      )
    if (r.surface === 'shell-knowledge-space')
      return (
        r.sksPresent === 1 &&
        r.graphLayerPresent === 1 &&
        r.inspectorPresent === 1 &&
        r.lensPresent === 1 &&
        r.canvasReused === 1 &&
        r.noNewRailItem === 1 &&
        r.sharedBackendIdentity === 1 &&
        r.lensHighlightWorks === 1 &&
        r.readonlySpace === 1 &&
        r.errors === 0 &&
        (!r.fourohfour || r.fourohfour.length === 0)
      )
    return false
  })
  console.log('RESULT:', ok ? 'ALL_PASS' : 'FAILURES')
  process.exit(ok ? 0 : 2)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
