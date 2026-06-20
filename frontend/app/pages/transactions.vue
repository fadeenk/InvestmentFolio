<script setup lang="ts">
import { computed, ref } from 'vue'
import { createColumnHelper, createTable, getCoreRowModel } from '@tanstack/table-core'
import { useDataStore } from '~/stores/data.store'
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

const dataStore = useDataStore()
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
  accountId: dataStore.allAccounts[0]?.id ?? '',
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
  return new Map(dataStore.allAccounts.map((account) => [account.id, account.displayName]))
})

const typeOptions = Object.values(TransactionType)
const assetTypeOptions = Object.values(AssetType)
const isEditMode = computed(() => formMode.value === 'edit')
const formTitle = computed(() => (isEditMode.value ? 'Edit transaction' : 'New transaction'))

const tabCounts = computed(() => ({
  ALL: dataStore.allTransactions.length,
  TRADES: dataStore.trades.length,
  DIVIDENDS: dataStore.dividendTransactions.length,
  INTEREST: dataStore.interestTransactions.length,
  TRANSFERS: dataStore.transfers.length,
  MANUAL: dataStore.manualTransactions.length,
}))

const tabbedTransactions = computed(() => {
  switch (activeTab.value) {
    case 'TRADES':
      return dataStore.trades
    case 'DIVIDENDS':
      return dataStore.dividendTransactions
    case 'INTEREST':
      return dataStore.interestTransactions
    case 'TRANSFERS':
      return dataStore.transfers
    case 'MANUAL':
      return dataStore.manualTransactions
    case 'ALL':
    default:
      return dataStore.allTransactions
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
    accountId: dataStore.allAccounts[0]?.id ?? '',
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
  const tx = dataStore.allTransactions.find((item) => item.id === row.id)
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

    dataStore.updateTransaction(editingId.value, {
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
    dataStore.addManual({
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
  dataStore.deleteTransaction(id)
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UButton label="New transaction" color="primary" size="xs" @click="openAdd" />
        <UButton label="Dashboard" to="/dashboard" color="neutral" variant="ghost" size="xs" />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        label="All"
        size="xs"
        :color="activeTab === 'ALL' ? 'primary' : 'neutral'"
        :variant="activeTab === 'ALL' ? 'solid' : 'ghost'"
        @click="activeTab = 'ALL'"
      />
      <UButton
        label="Trades"
        size="xs"
        :color="activeTab === 'TRADES' ? 'primary' : 'neutral'"
        :variant="activeTab === 'TRADES' ? 'solid' : 'ghost'"
        @click="activeTab = 'TRADES'"
      />
      <UButton
        label="Dividends"
        size="xs"
        :color="activeTab === 'DIVIDENDS' ? 'primary' : 'neutral'"
        :variant="activeTab === 'DIVIDENDS' ? 'solid' : 'ghost'"
        @click="activeTab = 'DIVIDENDS'"
      />
      <UButton
        label="Interest"
        size="xs"
        :color="activeTab === 'INTEREST' ? 'primary' : 'neutral'"
        :variant="activeTab === 'INTEREST' ? 'solid' : 'ghost'"
        @click="activeTab = 'INTEREST'"
      />
      <UButton
        label="Transfers"
        size="xs"
        :color="activeTab === 'TRANSFERS' ? 'primary' : 'neutral'"
        :variant="activeTab === 'TRANSFERS' ? 'solid' : 'ghost'"
        @click="activeTab = 'TRANSFERS'"
      />
      <UButton
        label="Manual"
        size="xs"
        :color="activeTab === 'MANUAL' ? 'primary' : 'neutral'"
        :variant="activeTab === 'MANUAL' ? 'solid' : 'ghost'"
        @click="activeTab = 'MANUAL'"
      />
    </div>

    <div class="rounded-sm border border-(--ui-border) bg-(--ui-bg-elevated) p-3">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <USelect
          v-model="selectedAccountId"
          :items="[{ label: 'All', value: 'ALL' }, ...dataStore.allAccounts.map((a) => ({ label: a.displayName, value: a.id }))]"
          placeholder="Account"
          size="xs"
          variant="outline"
          color="neutral"
        />
        <USelect
          v-model="selectedType"
          :items="[{ label: 'All', value: 'ALL' }, ...typeOptions.map((t) => ({ label: t, value: t }))]"
          placeholder="Type"
          size="xs"
          variant="outline"
          color="neutral"
        />
        <UInput v-model="symbolFilter" placeholder="Symbol" size="xs" variant="outline" color="neutral" />
        <UInput v-model="dateFrom" type="date" size="xs" variant="outline" color="neutral" />
        <UInput v-model="dateTo" type="date" size="xs" variant="outline" color="neutral" />
      </div>
      <div class="text-2xs mt-2 flex flex-wrap gap-2 text-(--ui-text-muted)">
        <span>All: {{ tabCounts.ALL }}</span>
        <span>Trades: {{ tabCounts.TRADES }}</span>
        <span>Dividends: {{ tabCounts.DIVIDENDS }}</span>
        <span>Interest: {{ tabCounts.INTEREST }}</span>
        <span>Transfers: {{ tabCounts.TRANSFERS }}</span>
        <span>Manual: {{ tabCounts.MANUAL }}</span>
      </div>
    </div>

    <div class="overflow-hidden rounded-sm border border-(--ui-border)">
      <div class="flex items-center justify-between border-b border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-1.5">
        <span class="text-xs font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Transactions</span>
        <span class="text-2xs text-(--ui-text-muted)">{{ table.getRowModel().rows.length }} visible rows</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-(--ui-border)">
              <th
                v-for="header in table.getFlatHeaders()"
                :key="header.id"
                class="text-2xs px-3 py-2 text-left font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase"
              >
                {{ header.column.columnDef.header }}
              </th>
              <th class="text-2xs px-3 py-2 text-right font-[var(--font-mono)] tracking-wide text-(--ui-text-muted) uppercase">Actions</th>
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
    </div>

    <UModal v-model:open="formOpen" :title="formTitle" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="grid gap-3 md:grid-cols-2">
          <USelect
            v-model="transactionForm.accountId"
            :items="dataStore.allAccounts.map((a) => ({ label: a.displayName, value: a.id }))"
            size="xs"
            variant="outline"
            color="neutral"
            :disabled="isEditMode"
          />
          <UInput v-model="transactionForm.date" type="date" size="xs" variant="outline" color="neutral" />
          <USelect v-model="transactionForm.type" :items="typeOptions.map((t) => ({ label: t, value: t }))" size="xs" variant="outline" color="neutral" />
          <USelect
            v-model="transactionForm.assetType"
            :items="assetTypeOptions.map((a) => ({ label: a, value: a }))"
            size="xs"
            variant="outline"
            color="neutral"
          />
          <UInput v-model="transactionForm.symbol" size="xs" variant="outline" color="neutral" />
          <UInput v-model="transactionForm.description" size="xs" variant="outline" color="neutral" />
          <UInput v-model="transactionForm.quantity" type="number" step="0.0001" size="xs" variant="outline" color="neutral" />
          <UInput v-model="transactionForm.price" type="number" step="0.0001" size="xs" variant="outline" color="neutral" />
          <UInput v-model="transactionForm.fees" type="number" step="0.01" size="xs" variant="outline" color="neutral" />
          <textarea
            v-model="transactionForm.notes"
            class="min-h-24 w-full rounded-sm border border-(--ui-border) bg-(--ui-bg) px-3 py-2 text-xs md:col-span-2"
          />
        </div>
      </template>

      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="formOpen = false" />
        <UButton :label="isEditMode ? 'Save' : 'Add'" color="primary" @click="saveTransaction" />
      </template>
    </UModal>
  </div>
</template>
