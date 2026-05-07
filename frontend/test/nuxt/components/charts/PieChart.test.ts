import { mount } from '@vue/test-utils'
import PieChart from '~/components/charts/PieChart.vue'

describe('PieChart', () => {
  it('should render with data', () => {
    const wrapper = mount(PieChart, {
      props: {
        data: [
          { label: 'Stocks', value: 6000 },
          { label: 'Bonds', value: 4000 }
        ]
      }
    })
    expect(wrapper.find('.w-full.h-64.p-4').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(PieChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })
})
