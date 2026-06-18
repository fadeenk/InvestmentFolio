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
})
