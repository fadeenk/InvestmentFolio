import { mount } from '@vue/test-utils'
import BarChart from '~/components/charts/BarChart.vue'

describe('BarChart', () => {
  it('should render with data', () => {
    const wrapper = mount(BarChart, {
      props: {
        data: [
          { category: 'AAPL', value: 1550 },
          { category: 'GOOGL', value: 2800 }
        ]
      }
    })
    expect(wrapper.find('.w-full.h-64.p-4').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(BarChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })
})
