import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import AppUpdatePrompt from '~/components/AppUpdatePrompt.vue'

const mocks = vi.hoisted(() => ({
  mockUseRegisterSW: vi.fn(),
}))

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: mocks.mockUseRegisterSW,
}))

function stubs() {
  return {
    UButton: {
      props: ['label'],
      template: '<button>{{ label }}</button>',
    },
  }
}

describe('AppUpdatePrompt', () => {
  beforeEach(() => {
    mocks.mockUseRegisterSW.mockReturnValue({
      needRefresh: { value: false },
      offlineReady: { value: false },
      updateServiceWorker: vi.fn(() => Promise.resolve()),
    })
  })

  it('renders nothing when no update is available', () => {
    const wrapper = mount(AppUpdatePrompt, { global: { stubs: stubs() } })
    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows refresh prompt when needRefresh is true', async () => {
    const updateServiceWorker = vi.fn(() => Promise.resolve())

    mocks.mockUseRegisterSW.mockReturnValue({
      needRefresh: { value: true },
      offlineReady: { value: false },
      updateServiceWorker,
    })

    const wrapper = mount(AppUpdatePrompt, { global: { stubs: stubs() } })
    expect(wrapper.text()).toContain('New version available')
    expect(wrapper.text()).toContain('Refresh')

    await wrapper.find('button').trigger('click')
    expect(updateServiceWorker).toHaveBeenCalledWith(true)

    wrapper.unmount()
  })

  it('shows offline ready toast when offlineReady is true', () => {
    mocks.mockUseRegisterSW.mockReturnValue({
      needRefresh: { value: false },
      offlineReady: { value: true },
      updateServiceWorker: vi.fn(() => Promise.resolve()),
    })

    const wrapper = mount(AppUpdatePrompt, { global: { stubs: stubs() } })
    expect(wrapper.text()).toContain('Ready for offline use')
    wrapper.unmount()
  })

  it('dismisses when user clicks Got it', async () => {
    const updateServiceWorker = vi.fn(() => Promise.resolve())

    mocks.mockUseRegisterSW.mockReturnValue({
      needRefresh: { value: false },
      offlineReady: { value: true },
      updateServiceWorker,
    })

    const wrapper = mount(AppUpdatePrompt, { global: { stubs: stubs() } })
    expect(wrapper.text()).toContain('Ready for offline use')

    const buttons = wrapper.findAll('button')
    const gotIt = buttons.find((b) => b.text() === 'Got it')
    expect(gotIt).toBeDefined()
    await gotIt!.trigger('click')
    expect(updateServiceWorker).toHaveBeenCalledWith(false)

    wrapper.unmount()
  })
})
