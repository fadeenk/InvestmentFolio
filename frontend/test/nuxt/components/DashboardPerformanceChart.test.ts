import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DashboardPerformanceChart from '~/components/dashboard/DashboardPerformanceChart.vue'

describe('DashboardPerformanceChart', () => {
  it('computes cumulative return percentage from data', () => {
    const data = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 110 },
      { date: '2026-01-03', value: 95 },
    ]

    const wrapper = mount(DashboardPerformanceChart, {
      props: { data, timeRange: 'YTD' },
      global: {
        stubs: { ApexLineChart: { template: '<div />' } },
      },
    })

    const vm = wrapper.vm as unknown as {
      performanceData: { date: string; value: number }[]
      lineColor: string
    }
    expect(vm.performanceData).toHaveLength(3)
    expect(vm.performanceData[0]!.value).toBe(0)
    expect(vm.performanceData[1]!.value).toBe(10)
    expect(vm.performanceData[2]!.value).toBe(-5)
  })

  it('uses green color when latest return is positive', () => {
    const data = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 110 },
    ]

    const wrapper = mount(DashboardPerformanceChart, {
      props: { data, timeRange: 'YTD' },
      global: { stubs: { ApexLineChart: { template: '<div />' } } },
    })

    const vm = wrapper.vm as unknown as { lineColor: string }
    expect(vm.lineColor).toBe('#00c853')
  })

  it('uses red color when latest return is negative', () => {
    const data = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 90 },
    ]

    const wrapper = mount(DashboardPerformanceChart, {
      props: { data, timeRange: 'YTD' },
      global: { stubs: { ApexLineChart: { template: '<div />' } } },
    })

    const vm = wrapper.vm as unknown as { lineColor: string }
    expect(vm.lineColor).toBe('#ff5252')
  })

  it('shows header with time range', () => {
    const data = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 110 },
    ]

    const wrapper = mount(DashboardPerformanceChart, {
      props: { data, timeRange: '1M' },
      global: { stubs: { ApexLineChart: { template: '<div />' } } },
    })

    expect(wrapper.text()).toContain('Portfolio Performance')
    expect(wrapper.text()).toContain('1M')
  })

  it('shows no data when empty', () => {
    const wrapper = mount(DashboardPerformanceChart, {
      props: { data: [], timeRange: 'YTD' },
      global: { stubs: { ApexLineChart: { template: '<div />' } } },
    })

    expect(wrapper.text()).toContain('No data available')
  })

  it('shows no data when base value is zero', () => {
    const data = [
      { date: '2026-01-01', value: 0 },
      { date: '2026-01-02', value: 100 },
    ]

    const wrapper = mount(DashboardPerformanceChart, {
      props: { data, timeRange: 'YTD' },
      global: { stubs: { ApexLineChart: { template: '<div />' } } },
    })

    expect(wrapper.text()).toContain('No data available')
  })
})
