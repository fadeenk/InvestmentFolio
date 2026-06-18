import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApexLineChart from '~/components/charts/ApexLineChart.vue'

describe('ApexLineChart', () => {
  it('should render with data', () => {
    const wrapper = mount(ApexLineChart, {
      props: {
        data: [
          { date: '2026-01-01', value: 10000 },
          { date: '2026-01-02', value: 10500 },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(ApexLineChart, {
      props: { data: [] },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })
})
