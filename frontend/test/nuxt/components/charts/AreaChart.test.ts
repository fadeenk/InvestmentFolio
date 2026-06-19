import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApexAreaChart from '~/components/charts/ApexAreaChart.vue'

describe('ApexAreaChart', () => {
  it('should render with data', () => {
    const wrapper = mount(ApexAreaChart, {
      props: {
        series: [{ name: 'Balance', data: [{ x: Date.parse('2026-01-01'), y: 10000 }], color: '#6366f1' }],
      },
    })
    expect(wrapper.text()).not.toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback for empty series', () => {
    const wrapper = mount(ApexAreaChart, {
      props: { series: [] },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })

  it('should show fallback when all series have empty data', () => {
    const wrapper = mount(ApexAreaChart, {
      props: {
        series: [{ name: 'Balance', data: [], color: '#6366f1' }],
      },
    })
    expect(wrapper.text()).toContain('No data available')
    wrapper.unmount()
  })
})
