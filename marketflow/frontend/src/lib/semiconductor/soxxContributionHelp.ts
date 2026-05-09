export type SoxxContributionHelpItem = {
  id: string
  label: string
  short: string
  detail: string
}

export const SOXX_CONTRIBUTION_HELP_ITEMS: SoxxContributionHelpItem[] = [
  {
    id: 'coverage',
    label: 'Coverage',
    short: 'Mapped SOXX holdings weight.',
    detail:
      'Coverage shows how much of SOXX holdings are mapped to selected internal buckets. It is not return contribution.',
  },
  {
    id: 'contribution',
    label: 'Contribution',
    short: 'Weight x return, measured in %p.',
    detail:
      'Contribution estimates how much a bucket added to or subtracted from SOXX movement using holding weight times holding return. The unit is percentage points.',
  },
  {
    id: 'residual',
    label: 'Residual',
    short: 'Other SOXX holdings outside selected buckets.',
    detail:
      'Residual represents SOXX holdings not mapped to selected buckets. It helps show whether movement is broad or concentrated.',
  },
  {
    id: 'relative_strength',
    label: 'Relative Strength',
    short: 'Bucket performance versus SOXX.',
    detail:
      'Relative strength compares selected bucket performance against SOXX. It is different from holding-weighted contribution.',
  },
  {
    id: 'trend',
    label: 'Contribution Trend',
    short: 'Backward-looking contribution history.',
    detail:
      'Contribution Trend shows how selected and residual contribution changed over recent dates. It is historical, not a forecast.',
  },
  {
    id: 'soxl',
    label: 'SOXL Sensitivity',
    short: 'Daily amplification context.',
    detail:
      'SOXL seeks daily 3x exposure. This lens interprets SOXX internal structure as daily sensitivity context, not as a simple multi-day 3x model.',
  },
]

export const SOXX_CONTRIBUTION_HELP_SUMMARY =
  'Read this panel as SOXX internal structure context: coverage shows mapped holdings weight, contribution shows historical percentage-point impact, and residual shows the rest of SOXX.'

export function getSoxxContributionHelpItem(
  id: string,
): SoxxContributionHelpItem | undefined {
  return SOXX_CONTRIBUTION_HELP_ITEMS.find((item) => item.id === id)
}
