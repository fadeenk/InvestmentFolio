<script setup lang="ts">
import { computed, ref } from 'vue'
import { createColumnHelper, createTable, getCoreRowModel } from '@tanstack/table-core'
import { useAccountsStore } from '~/stores/accounts.store'
import { useTransactionsStore } from '~/stores/transactions.store'
import { useUiStore } from '~/stores/ui'
import type { ImportSource } from '~/types/enums'
import { AssetType, TransactionType } from '~/types/enums'
import { transactionCashDelta } from '~/utils/ledger'

type TransactionTab = 'ALL' | 'TRADES' | 'DIVIDENDS' | 'INTEREST' | 'TRANSFERS' | 'MANUAL'
type FormMode = 'add' | 'edit'

type TransactionForm = {
  accountId: string
  date: string
  type: TransactionType
  assetType: AssetType
  symbol: string
  description: string
  quantity: string
  price: string
  fees: string
  notes: string
}

type TransactionRow = {
  id: string
  date: string
  account: string
  type: string
  symbol: string
  description: string
  quantity: string
  price: string
  amount: string
  rawAmount: number
  source: ImportSource
  editable: boolean
}

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const uiStore = useUiStore()

const activeTab = ref<TransactionTab>('ALL')
const selectedAccountId = ref<string>('ALL')
const selectedType = ref<string>('ALL')
const symbolFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const formOpen = ref(false)
const formMode = ref<FormMode>('add')
const editingId = ref<string | null>(null)
const transactionForm = ref<TransactionForm>({
  accountId: accountsStore.all[0]?.id ?? '',
  date: '',
  type: TransactionType.Buy,
  assetType: AssetType.Stock,
  symbol: '',
  description: '',
  quantity: '',
  price: '',
  fees: '0',
  notes: '',
})

const accountNameById = computed(() => {
  return new Map(accountsStore.all.map((account) => [account.id, account.displayName]))
})

const typeOptions = Object.values(TransactionType)
const assetTypeOptions = Object.values(AssetType)
const isEditMode = computed(() => formMode.value === 'edit')
const formTitle = computed(() => (isEditMode.value ? 'Edit transaction' : 'New transaction'))

const tabCounts = computed(() => ({
  ALL: transactionsStore.all.length,
  TRADES: transactionsStore.trades.length,
  DIVIDENDS: transactionsStore.dividends.length,
  INTEREST: transactionsStore.interest.length,
  TRANSFERS: transactionsStore.transfers.length,
  MANUAL: transactionsStore.manual.length,
}))

const tabbedTransactions = computed(() => {
  switch (activeTab.value) {
    case 'TRADES':
      return transactionsStore.trades
    case 'DIVIDENDS':
      return transactionsStore.dividends
    case 'INTEREST':
      return transactionsStore.interest
    case 'TRANSFERS':
      return transactionsStore.transfers
    case 'MANUAL':
      return transactionsStore.manual
    case 'ALL':
    default:
      return transactionsStore.all
  }
})

const filteredTransactions = computed(() => {
  return tabbedTransactions.value
    .filter((tx) => (selectedAccountId.value === 'ALL' ? true : tx.accountId === selectedAccountId.value))
    .filter((tx) => (selectedType.value === 'ALL' ? true : tx.type === selectedType.value))
    .filter((tx) => {
      if (!symbolFilter.value) return true
      return tx.symbol.toUpperCase().includes(symbolFilter.value.trim().toUpperCase())
    })
    .filter((tx) => {
      if (!dateFrom.value) return true
      return tx.date >= dateFrom.value
    })
    .filter((tx) => {
      if (!dateTo.value) return true
      return tx.date <= dateTo.value
    })
    .sort((a, b) => b.date.localeCompare(a.date))
})

const rows = computed<TransactionRow[]>(() => {
  return filteredTransactions.value.map((tx) => {
    const amount = signedAmount(tx)

    return {
      id: tx.id,
      date: uiStore.formatDate(tx.date),
      account: accountNameById.value.get(tx.accountId) ?? 'Unknown account',
      type: tx.type,
      symbol: tx.symbol,
      description: tx.description,
      quantity: tx.quantity === null ? '-' : formatNumber(tx.quantity),
      price: formatCurrency(tx.price),
      amount: formatCurrency(amount),
      rawAmount: amount,
      source: tx.importSource,
      editable: !tx.externalId,
    }
  })
})

const columnHelper = createColumnHelper<TransactionRow>()

const columns = [
  columnHelper.accessor('date', {
    header: 'Date',
  }),
  columnHelper.accessor('account', {
    header: 'Account',
  }),
  columnHelper.accessor('type', {
    header: 'Type',
  }),
  columnHelper.accessor('symbol', {
    header: 'Symbol',
  }),
  columnHelper.accessor('description', {
    header: 'Description',
  }),
  columnHelper.accessor('quantity', {
    header: 'Quantity',
  }),
  columnHelper.accessor('price', {
    header: 'Price',
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
  }),
]

const table = computed(() => {
  return createTable({
    data: rows.value,
    columns,
    state: {
      columnPinning: {
        left: [],
        right: [],
      },
    },
    onStateChange: () => undefined,
    renderFallbackValue: '',
    getCoreRowModel: getCoreRowModel(),
  })
})

function signedAmount(tx: (typeof filteredTransactions.value)[number]): number {
  return transactionCashDelta(tx)
}

function signClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-300'
  if (value < 0) return 'text-red-600 dark:text-red-300'
  return 'text-(--ui-text-muted)'
}

function isFiniteInputNumber(value: string): boolean {
  return Number.isFinite(Number(value))
}

function normalizeInput(value: string | number | null | undefined): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return ''
}

function getDefaultForm(): TransactionForm {
  return {
    accountId: accountsStore.all[0]?.id ?? '',
    date: new Date().toISOString().slice(0, 10),
    type: TransactionType.Buy,
    assetType: AssetType.Stock,
    symbol: '',
    description: '',
    quantity: '',
    price: '',
    fees: '0',
    notes: '',
  }
}

function openEdit(row: TransactionRow): void {
  const tx = transactionsStore.all.find((item) => item.id === row.id)
  if (!tx || tx.externalId) return

  formMode.value = 'edit'
  editingId.value = tx.id
  transactionForm.value = {
    accountId: tx.accountId,
    date: tx.date,
    type: tx.type,
    assetType: tx.assetType,
    symbol: tx.symbol,
    description: tx.description,
    quantity: tx.quantity === null ? '' : String(tx.quantity),
    price: String(tx.price),
    fees: String(tx.fees),
    notes: tx.notes ?? '',
  }
  formOpen.value = true
}

function openAdd(): void {
  formMode.value = 'add'
  editingId.value = null
  transactionForm.value = getDefaultForm()
  formOpen.value = true
}

function saveTransaction(): void {
  const priceInput = normalizeInput(transactionForm.value.price)
  const feesInput = normalizeInput(transactionForm.value.fees)
  const quantityInput = normalizeInput(transactionForm.value.quantity)
  const symbolInput = normalizeInput(transactionForm.value.symbol).toUpperCase()
  const descriptionInput = normalizeInput(transactionForm.value.description)
  const notesInput = normalizeInput(transactionForm.value.notes)

  if (!transactionForm.value.accountId || !transactionForm.value.date) return
  if (!isFiniteInputNumber(priceInput) || !isFiniteInputNumber(feesInput)) return
  if (quantityInput !== '' && !isFiniteInputNumber(quantityInput)) return

  if (isEditMode.value) {
    if (!editingId.value) return

    transactionsStore.updateTransaction(editingId.value, {
      date: transactionForm.value.date,
      type: transactionForm.value.type,
      assetType: transactionForm.value.assetType,
      symbol: symbolInput,
      description: descriptionInput,
      quantity: quantityInput === '' ? null : Number(quantityInput),
      price: Number(priceInput),
      fees: Number(feesInput),
      notes: notesInput === '' ? null : notesInput,
    })
  } else {
    transactionsStore.addManual({
      accountId: transactionForm.value.accountId,
      date: transactionForm.value.date,
      type: transactionForm.value.type,
      assetType: transactionForm.value.assetType,
      symbol: symbolInput,
      description: descriptionInput,
      quantity: quantityInput === '' ? null : Number(quantityInput),
      price: Number(priceInput),
      fees: Number(feesInput),
      notes: notesInput === '' ? null : notesInput,
    })
    activeTab.value = 'MANUAL'
  }

  formOpen.value = false
  editingId.value = null
  transactionForm.value = getDefaultForm()
}

function deleteTransaction(id: string): void {
  transactionsStore.deleteTransaction(id)
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Transactions</h1>
        <p class="text-sm text-(--ui-text-muted)">Filter by type, account, symbol, and date range.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton label="New transaction" color="primary" @click="openAdd" />
        <UButton label="Dashboard" to="/dashboard" color="neutral" variant="outline" />
      </div>
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="All"
            size="xs"
            :color="activeTab === 'ALL' ? 'primary' : 'neutral'"
            :variant="activeTab === 'ALL' ? 'solid' : 'outline'"
            @click="activeTab = 'ALL'"
          />
          <UButton
            label="Trades"
            size="xs"
            :color="activeTab === 'TRADES' ? 'primary' : 'neutral'"
            :variant="activeTab === 'TRADES' ? 'solid' : 'outline'"
            @click="activeTab = 'TRADES'"
          />
          <UButton
            label="Dividends"
            size="xs"
            :color="activeTab === 'DIVIDENDS' ? 'primary' : 'neutral'"
            :variant="activeTab === 'DIVIDENDS' ? 'solid' : 'outline'"
            @click="activeTab = 'DIVIDENDS'"
          />
          <UButton
            label="Interest"
            size="xs"
            :color="activeTab === 'INTEREST' ? 'primary' : 'neutral'"
            :variant="activeTab === 'INTEREST' ? 'solid' : 'outline'"
            @click="activeTab = 'INTEREST'"
          />
          <UButton
            label="Transfers"
            size="xs"
            :color="activeTab === 'TRANSFERS' ? 'primary' : 'neutral'"
            :variant="activeTab === 'TRANSFERS' ? 'solid' : 'outline'"
            @click="activeTab = 'TRANSFERS'"
          />
          <UButton
            label="Manual"
            size="xs"
            :color="activeTab === 'MANUAL' ? 'primary' : 'neutral'"
            :variant="activeTab === 'MANUAL' ? 'solid' : 'outline'"
            @click="activeTab = 'MANUAL'"
          />
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Account</span>
          <select v-model="selectedAccountId" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option value="ALL">All</option>
            <option v-for="account in accountsStore.all" :key="account.id" :value="account.id">{{ account.displayName }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Type</span>
          <select v-model="selectedType" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
            <option value="ALL">All</option>
            <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">Symbol</span>
          <input v-model="symbolFilter" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" placeholder="AAPL" type="text" />
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">From</span>
          <input v-model="dateFrom" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" type="date" />
        </label>

        <label class="space-y-1 text-sm">
          <span class="text-(--ui-text-muted)">To</span>
          <input v-model="dateTo" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" type="date" />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap gap-2 text-xs text-(--ui-text-muted)">
        <span>All: {{ tabCounts.ALL }}</span>
        <span>Trades: {{ tabCounts.TRADES }}</span>
        <span>Dividends: {{ tabCounts.DIVIDENDS }}</span>
        <span>Interest: {{ tabCounts.INTEREST }}</span>
        <span>Transfers: {{ tabCounts.TRANSFERS }}</span>
        <span>Manual: {{ tabCounts.MANUAL }}</span>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Transactions table</h2>
          <span class="text-sm text-(--ui-text-muted)">{{ table.getRowModel().rows.length }} visible rows</span>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th v-for="header in table.getFlatHeaders()" :key="header.id" class="px-3 py-2 text-left font-medium text-(--ui-text-muted)">
                {{ header.column.columnDef.header }}
              </th>
              <th class="px-3 py-2 text-right font-medium text-(--ui-text-muted)">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in table.getRowModel().rows" :key="row.id" class="border-b border-(--ui-border)/60">
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="px-3 py-2"
                :class="cell.column.id === 'amount' ? signClass(row.original.rawAmount) : ''"
              >
                {{ cell.getValue() }}
              </td>
              <td class="px-3 py-2 text-right">
                <div v-if="row.original.editable" class="flex justify-end gap-2">
                  <UButton label="Edit" size="xs" color="neutral" variant="outline" @click="openEdit(row.original)" />
                  <UButton label="Delete" size="xs" color="error" variant="outline" @click="deleteTransaction(row.original.id)" />
                </div>
                <span v-else class="text-xs text-(--ui-text-muted)">API locked</span>
              </td>
            </tr>

            <tr v-if="table.getRowModel().rows.length === 0">
              <td colspan="10" class="px-3 py-6 text-center text-(--ui-text-muted)">No transactions match the selected filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="formOpen" :title="formTitle" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Account</span>
            <select
              v-model="transactionForm.accountId"
              :disabled="isEditMode"
              class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
            >
              <option v-for="account in accountsStore.all" :key="account.id" :value="account.id">{{ account.displayName }}</option>
            </select>
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Date</span>
            <input v-model="transactionForm.date" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" type="date" />
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Type</span>
            <select v-model="transactionForm.type" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
              <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
            </select>
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Asset type</span>
            <select v-model="transactionForm.assetType" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm">
              <option v-for="assetType in assetTypeOptions" :key="assetType" :value="assetType">{{ assetType }}</option>
            </select>
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Symbol</span>
            <input v-model="transactionForm.symbol" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" type="text" />
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Description</span>
            <input v-model="transactionForm.description" class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" type="text" />
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Quantity</span>
            <input
              v-model="transactionForm.quantity"
              class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
              type="number"
              step="0.0001"
            />
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Price / Amount</span>
            <input
              v-model="transactionForm.price"
              class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
              type="number"
              step="0.0001"
            />
          </label>

          <label class="space-y-1 text-sm">
            <span class="text-(--ui-text-muted)">Fees</span>
            <input
              v-model="transactionForm.fees"
              class="w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm"
              type="number"
              step="0.01"
            />
          </label>
          <label class="space-y-1 text-sm md:col-span-2">
            <span class="text-(--ui-text-muted)">Notes</span>
            <textarea v-model="transactionForm.notes" class="min-h-24 w-full rounded-md border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-sm" />
          </label>
        </div>
      </template>

      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="formOpen = false" />
        <UButton :label="isEditMode ? 'Save' : 'Add'" color="primary" @click="saveTransaction" />
      </template>
    </UModal>
  </div>
</template>
