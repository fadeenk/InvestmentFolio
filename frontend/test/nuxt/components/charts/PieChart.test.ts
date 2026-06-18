import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApexDonutChart from '~/components/charts/ApexDonutChart.vue'

describe('ApexDonutChart', () => {
  it('should render with data', () => {
    const wrapper = mount(ApexDonutChart, {
      props: {
        data: [
          { label: 'Stocks', value: 6000 },
          { label: 'Bonds', value: 4000 },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(ApexDonutChart, {
      props: { data: [] },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })
})
