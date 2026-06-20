import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DashboardIncomeChart from '~/components/dashboard/DashboardIncomeChart.vue'

describe('DashboardIncomeChart', () => {
  const sampleData = [
    {
      year: 2024,
      accounts: [
        { accountName: 'Brokerage', dividends: 500, interest: 100 },
        { accountName: 'IRA', dividends: 300, interest: 50 },
      ],
    },
    {
      year: 2025,
      accounts: [
        { accountName: 'Brokerage', dividends: 700, interest: 150 },
        { accountName: 'IRA', dividends: 400, interest: 80 },
      ],
    },
  ]

  it('should render with income data', () => {
    const wrapper = mount(DashboardIncomeChart, {
      props: { data: sampleData },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(DashboardIncomeChart, {
      props: { data: [] },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback when accounts are empty', () => {
    const wrapper = mount(DashboardIncomeChart, {
      props: {
        data: [{ year: 2025, accounts: [] }],
      },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })
})
