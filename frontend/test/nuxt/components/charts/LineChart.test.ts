import { mount } from '@vue/test-utils'
import LineChart from '~/components/charts/LineChart.vue'

describe('LineChart', () => {
  it('should render with data', () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [
          { date: '2026-01-01', value: 10000 },
          { date: '2026-01-02', value: 10500 }
        ]
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('should show fallback for empty data', () => {
    const wrapper = mount(LineChart, {
      props: { data: [] }
    })
    expect(wrapper.text()).toContain('No data available')
  })

  it('should use xKey and yKey props', () => {
    const wrapper = mount(LineChart, {
      props: {
        data: [
          { date: '2026-01-01', value: 10000 },
          { date: '2026-01-02', value: 10500 }
        ],
        xKey: 'date',
        yKey: 'value'
      }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
