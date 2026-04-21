import { UI_TEXT as BASE_UI_TEXT, uiText, type UiCopy } from '@/i18n/resources'

const copy = (ko: string, en: string): UiCopy => ({ ko, en })

export const UI_TEXT = {
  ...BASE_UI_TEXT,
  nav: {
    ...BASE_UI_TEXT.nav,
    crashHub: copy('크래시 허브', 'Crash Hub'),
    leverageHub: copy('레버리지 허브', 'Leverage Hub'),
    standardRisk: copy('표준위험분석', 'Standard Risk'),
    vrTest: copy('VR 돋보기', 'VR-Test'),
    vrSurvival: copy('레버리지 생존법', 'Leverage Survival'),
    news: (BASE_UI_TEXT.nav as Record<string, UiCopy>).news ?? copy('뉴스', 'News'),
  },
  risk: {
    ...BASE_UI_TEXT.risk,
    title: copy('표준위험분석', 'Standard Risk System'),
    crashHub: copy('← 크래시 허브', '← Crash Hub'),
    standardRisk: copy('표준위험분석', 'Standard Risk'),
  },
  crash: {
    ...BASE_UI_TEXT.crash,
    hub: copy('크래시 허브', 'Crash Hub'),
    leverageHub: copy('레버리지 허브', 'Leverage Hub'),
    standardRisk: copy('표준위험분석', 'Standard Risk'),
  },
  vr: {
    ...BASE_UI_TEXT.vr,
    survival: copy('레버리지 생존법', 'Leverage Survival'),
    test: copy('VR 돋보기', 'VR-Test'),
  },
} as const

export { uiText, type UiCopy }
