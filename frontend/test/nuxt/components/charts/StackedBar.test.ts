import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApexStackedBar from '~/components/charts/ApexStackedBar.vue'

describe('ApexStackedBar', () => {
  it('should render with data', () => {
    const wrapper = mount(ApexStackedBar, {
      props: {
        categories: ['Jan', 'Feb'],
        series: [
          { name: 'Dividends', data: [500, 700], color: '#10b981' },
          { name: 'Interest', data: [100, 200], color: '#3b82f6' },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback for empty categories', () => {
    const wrapper = mount(ApexStackedBar, {
      props: {
        categories: [],
        series: [],
      },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback when all series have no data', () => {
    const wrapper = mount(ApexStackedBar, {
      props: {
        categories: ['Jan', 'Feb'],
        series: [
          { name: 'Dividends', data: [], color: '#10b981' },
          { name: 'Interest', data: [], color: '#3b82f6' },
        ],
      },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })

  it('should render with grouped series', () => {
    const wrapper = mount(ApexStackedBar, {
      props: {
        categories: ['2024', '2025'],
        series: [
          { name: 'Acct A · Div', data: [500, 700], color: '#10b981', group: 'dividends' },
          { name: 'Acct B · Div', data: [300, 400], color: '#34d399', group: 'dividends' },
          { name: 'Acct A · Int', data: [100, 200], color: '#3b82f6', group: 'interest' },
          { name: 'Acct B · Int', data: [50, 80], color: '#60a5fa', group: 'interest' },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })
})
