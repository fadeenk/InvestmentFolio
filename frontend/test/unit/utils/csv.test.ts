import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  toTransactionType,
  toAssetType,
  toNumber,
  toOptionalNumber,
  normalizeDate,
  getCsvSchemaForAccount,
  CSV_SCHEMAS_BY_BANK,
} from '~/utils/csv'
import { TransactionType, AssetType, Bank } from '~/types/enums'
import type { Account } from '~/types/vault'

describe('parseCsvText', () => {
  it('parses a basic CSV with headers and rows', () => {
    const csv = 'date,symbol,amount\n2024-01-05,AAPL,10\n2024-01-06,GOOG,5'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ date: '2024-01-05', symbol: 'AAPL', amount: '10' })
    expect(rows[1]).toEqual({ date: '2024-01-06', symbol: 'GOOG', amount: '5' })
  })

  it('handles trailing newlines and empty lines', () => {
    const csv = 'a,b\n1,2\n\n3,4\n\n'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual({ a: '3', b: '4' })
  })

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(2)
  })

  it('returns empty array for header-only CSV', () => {
    const rows = parseCsvText('a,b,c')
    expect(rows).toHaveLength(0)
  })

  it('returns empty array for single line', () => {
    const rows = parseCsvText('just a line')
    expect(rows).toHaveLength(0)
  })

  it('returns empty array for empty string', () => {
    const rows = parseCsvText('')
    expect(rows).toHaveLength(0)
  })

  it('handles quoted fields with commas inside', () => {
    const csv = 'a,b\n"hello, world",foo'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].a).toBe('hello, world')
  })

  it('handles quoted fields with escaped quotes', () => {
    const csv = 'a\n"say ""hello"""'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].a).toBe('say "hello"')
  })

  it('trims leading/trailing whitespace from headers and values', () => {
    const csv = '  date , symbol  \n  2024-01-05 , AAPL  '
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ date: '2024-01-05', symbol: 'AAPL' })
  })

  it('normalises header names to lowercase', () => {
    const csv = 'Date,Symbol,Amount\n2024-01-05,AAPL,100'
    const rows = parseCsvText(csv)
    expect(rows[0]).toHaveProperty('date')
    expect(rows[0]).toHaveProperty('symbol')
    expect(rows[0]).toHaveProperty('amount')
  })

  it('fills missing trailing columns as empty strings', () => {
    const csv = 'a,b,c\n1,2'
    const rows = parseCsvText(csv)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' })
  })
})

describe('toTransactionType', () => {
  it('maps "Buy" to TransactionType.Buy', () => {
    expect(toTransactionType('Buy')).toBe(TransactionType.Buy)
  })

  it('maps "sell" to TransactionType.Sell', () => {
    expect(toTransactionType('sell')).toBe(TransactionType.Sell)
  })

  it('maps "Dividend" variants correctly', () => {
    expect(toTransactionType('DIVIDEND')).toBe(TransactionType.Dividend)
    expect(toTransactionType('DIV')).toBe(TransactionType.Dividend)
    expect(toTransactionType('Cash Dividend')).toBe(TransactionType.Dividend)
  })

  it('maps "Interest" variants correctly', () => {
    expect(toTransactionType('Interest')).toBe(TransactionType.Interest)
    expect(toTransactionType('Credit Interest')).toBe(TransactionType.Interest)
  })

  it('maps "Split" to TransactionType.Split', () => {
    expect(toTransactionType('Split')).toBe(TransactionType.Split)
  })

  it('maps deposit-related types', () => {
    expect(toTransactionType('DEPOSIT')).toBe(TransactionType.DEPOSIT)
    expect(toTransactionType('Funds Received')).toBe(TransactionType.DEPOSIT)
  })

  it('maps "Withdrawal" correctly', () => {
    expect(toTransactionType('Withdrawal')).toBe(TransactionType.WITHDRAWAL)
  })

  it('maps Transfer In/Out correctly', () => {
    expect(toTransactionType('Transfer In')).toBe(TransactionType.TRANSFER_IN)
    expect(toTransactionType('Transfer Out')).toBe(TransactionType.TRANSFER_OUT)
  })

  it('maps "Journal" to TransactionType.Journal', () => {
    expect(toTransactionType('Journal')).toBe(TransactionType.Journal)
  })

  it('handles extra whitespace and hyphens', () => {
    expect(toTransactionType('  TRANSFER-IN  ')).toBe(TransactionType.TRANSFER_IN)
    expect(toTransactionType('cash-dividend')).toBe(TransactionType.Dividend)
    expect(toTransactionType('transfer out')).toBe(TransactionType.TRANSFER_OUT)
  })

  it('throws on unsupported type', () => {
    expect(() => toTransactionType('UnknownType')).toThrow('Unsupported transaction type: UnknownType')
  })
})

describe('toAssetType', () => {
  it('maps "BOND" to AssetType.Bond', () => {
    expect(toAssetType('BOND', '')).toBe(AssetType.Bond)
  })

  it('maps "ETF" to AssetType.ETF', () => {
    expect(toAssetType('ETF', '')).toBe(AssetType.ETF)
  })

  it('maps "MUTUALFUND" and "MUTUAL_FUND" to AssetType.MutualFund', () => {
    expect(toAssetType('MUTUALFUND', '')).toBe(AssetType.MutualFund)
    expect(toAssetType('MUTUAL_FUND', '')).toBe(AssetType.MutualFund)
  })

  it('maps "CASH" to AssetType.Cash', () => {
    expect(toAssetType('CASH', '')).toBe(AssetType.Cash)
  })

  it('maps "CRYPTO" to AssetType.Crypto', () => {
    expect(toAssetType('CRYPTO', '')).toBe(AssetType.Crypto)
  })

  it('maps "STOCK" to AssetType.Stock', () => {
    expect(toAssetType('STOCK', '')).toBe(AssetType.Stock)
  })

  it('defaults unknown raw types to Stock', () => {
    expect(toAssetType('OPTION', '')).toBe(AssetType.Stock)
    expect(toAssetType(undefined, '')).toBe(AssetType.Stock)
    expect(toAssetType('', '')).toBe(AssetType.Stock)
  })

  it('detects US Treasury Bills from description regardless of raw type', () => {
    expect(toAssetType('STOCK', 'US TREASURY BILL 1.5% 2025-01-01')).toBe(AssetType.CashEquivalent)
    expect(toAssetType('BOND', 'US TREASURY BIL')).toBe(AssetType.CashEquivalent)
  })

  it('normalises case and whitespace in raw type', () => {
    expect(toAssetType('  etf  ', '')).toBe(AssetType.ETF)
    expect(toAssetType('MutualFund', '')).toBe(AssetType.MutualFund)
  })
})

describe('toNumber', () => {
  it('parses a plain number string', () => {
    expect(toNumber('123.45')).toBe(123.45)
  })

  it('removes dollar signs', () => {
    expect(toNumber('$1,234.56')).toBe(1234.56)
  })

  it('removes commas', () => {
    expect(toNumber('1,234,567.89')).toBe(1234567.89)
  })

  it('handles parenthesised negative numbers', () => {
    expect(toNumber('(100.00)')).toBe(-100)
  })

  it('handles trailing minus sign', () => {
    expect(toNumber('100.00-')).toBe(-100)
  })

  it('handles leading minus sign', () => {
    expect(toNumber('-100.00')).toBe(-100)
  })

  it('handles leading plus sign', () => {
    expect(toNumber('+100.00')).toBe(100)
  })

  it('treats empty string as default value', () => {
    expect(toNumber('', 42)).toBe(42)
  })

  it('treats whitespace-only string as default value', () => {
    expect(toNumber('   ', 42)).toBe(42)
  })

  it('returns default value of 0 when no default given for empty', () => {
    expect(toNumber('')).toBe(0)
  })

  it('throws on completely invalid input', () => {
    expect(() => toNumber('not-a-number')).toThrow('Invalid number: not-a-number')
  })
})

describe('toOptionalNumber', () => {
  it('returns null for empty string', () => {
    expect(toOptionalNumber('')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(toOptionalNumber(undefined)).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(toOptionalNumber('   ')).toBeNull()
  })

  it('delegates to toNumber for valid input', () => {
    expect(toOptionalNumber('42.5')).toBe(42.5)
  })

  it('delegates to toNumber for negative values', () => {
    expect(toOptionalNumber('(50)')).toBe(-50)
  })
})

describe('normalizeDate', () => {
  it('returns ISO string for a valid date', () => {
    const result = normalizeDate('2024-01-05')
    expect(result).toBe('2024-01-05T00:00:00.000Z')
  })

  it('throws for invalid date strings', () => {
    expect(() => normalizeDate('not-a-date')).toThrow('Invalid date: not-a-date')
  })
})

describe('getCsvSchemaForAccount', () => {
  it('returns the schema for the accounts bank', () => {
    const account = { bank: Bank.SCHWAB } as Account
    const schema = getCsvSchemaForAccount(account)
    expect(schema).toBe(CSV_SCHEMAS_BY_BANK[Bank.SCHWAB])
  })

  it('returns OTHER schema for OPTUM account', () => {
    const account = { bank: Bank.OPTUM } as Account
    const schema = getCsvSchemaForAccount(account)
    expect(schema).toBe(CSV_SCHEMAS_BY_BANK[Bank.OPTUM])
  })

  it('returns OTHER schema for undefined account', () => {
    const schema = getCsvSchemaForAccount(undefined)
    expect(schema).toBe(CSV_SCHEMAS_BY_BANK[Bank.OTHER])
  })

  it('returns OTHER schema for account without bank', () => {
    const account = {} as Account
    const schema = getCsvSchemaForAccount(account)
    expect(schema).toBe(CSV_SCHEMAS_BY_BANK[Bank.OTHER])
  })
})

describe('CSV_SCHEMAS_BY_BANK', () => {
  describe('Bank.OTHER schema', () => {
    const schema = CSV_SCHEMAS_BY_BANK[Bank.OTHER]

    it('has the correct required columns', () => {
      expect(schema.requiredColumns).toEqual(['date', 'type', 'action', 'symbol', 'amount', 'price', 'fees', 'total'])
    })

    it('mapRow extracts fields correctly', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        type: 'Buy',
        action: 'Buy',
        symbol: 'AAPL',
        amount: '10',
        price: '150.00',
        fees: '1.00',
        total: '1501.00',
      })
      expect(result.rawType).toBe('Buy')
      expect(result.symbol).toBe('AAPL')
      expect(result.quantity).toBe(10)
      expect(result.price).toBe(150)
      expect(result.date).toBe('2024-01-05')
      expect(result.fees).toBe(1)
    })

    it('uses action as fallback for rawType when type is missing', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Sell',
        symbol: 'AAPL',
        amount: '',
        price: '',
        fees: '',
        total: '',
      })
      expect(result.rawType).toBe('Sell')
    })

    it('handles missing externalId and notes as null', () => {
      const result = schema.mapRow({
        date: '',
        type: '',
        action: '',
        symbol: '',
        amount: '',
        price: '',
        fees: '',
        total: '',
      })
      expect(result.externalId).toBeNull()
      expect(result.notes).toBeNull()
    })
  })

  describe('Bank.OPTUM schema', () => {
    const schema = CSV_SCHEMAS_BY_BANK[Bank.OPTUM]

    it('has the correct required columns', () => {
      expect(schema.requiredColumns).toEqual(['date', 'transaction type', 'requested action', 'amount', 'fund name', 'shares', 'share price'])
    })

    it('mapRow uses requested action as rawType with fallback', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        'transaction type': 'BUY',
        'requested action': 'Purchase',
        amount: '1000',
        'fund name': 'Vanguard Total Market',
        shares: '10.5',
        'share price': '95.24',
      })
      expect(result.rawType).toBe('Purchase')
      expect(result.symbol).toBe('VANGUARD TOTAL MARKET')
      expect(result.quantity).toBe(10.5)
      expect(result.price).toBe(95.24)
    })

    it('mapRow falls back to transaction type when no requested action', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        'transaction type': 'SELL',
        'requested action': '',
        amount: '500',
        'fund name': 'Fidelity Fund',
        shares: '',
        'share price': '',
      })
      expect(result.rawType).toBe('SELL')
    })

    it('mapRow uses amount as price when share price is unavailable', () => {
      const result = schema.mapRow({
        date: '',
        'transaction type': '',
        'requested action': '',
        amount: '500',
        'fund name': '',
        shares: '',
        'share price': '',
      })
      expect(result.price).toBe(500)
    })

    it('mapRow defaults fees to 0', () => {
      const result = schema.mapRow({
        date: '',
        'transaction type': '',
        'requested action': '',
        amount: '',
        'fund name': '',
        shares: '',
        'share price': '',
      })
      expect(result.fees).toBe(0)
    })
  })

  describe('Bank.SCHWAB schema', () => {
    const schema = CSV_SCHEMAS_BY_BANK[Bank.SCHWAB]

    it('has the correct required columns', () => {
      expect(schema.requiredColumns).toEqual(['date', 'action', 'symbol', 'description', 'quantity', 'price', 'fees & comm', 'amount'])
    })

    it('mapRow extracts standard fields', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Buy',
        symbol: 'AAPL',
        description: 'APPLE INC',
        quantity: '10',
        price: '150.00',
        'fees & comm': '0.50',
        amount: '1500.50',
      })
      expect(result.symbol).toBe('AAPL')
      expect(result.description).toBe('APPLE INC')
      expect(result.fees).toBe(0.5)
    })

    it('mapRow maps "Full Redemption" action to Sell and negates quantity', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Full Redemption',
        symbol: 'USFR',
        description: 'US TREASURY BILL',
        quantity: '100',
        price: '1.00',
        'fees & comm': '0',
        amount: '100',
      })
      expect(result.rawType).toBe(TransactionType.Sell)
      expect(result.quantity).toBe(-100)
      expect(result.price).toBe(1)
    })

    it('mapRow maps "Security Transfer" to Buy', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Security Transfer',
        symbol: 'AAPL',
        description: 'APPLE INC',
        quantity: '50',
        price: '0',
        'fees & comm': '0',
        amount: '0',
      })
      expect(result.rawType).toBe(TransactionType.Buy)
    })

    it('mapRow maps "Journal" with TRANSFER FUNDS to DEPOSIT', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Journal',
        symbol: '',
        description: 'TRANSFER FUNDS CASH',
        quantity: '',
        price: '',
        'fees & comm': '',
        amount: '5000',
      })
      expect(result.rawType).toBe(TransactionType.DEPOSIT)
    })

    it('filterRow filters out "Full Redemption Adj" rows', () => {
      expect(schema.filterRow!({ action: 'Full Redemption Adj' })).toBe(false)
    })

    it('filterRow keeps normal rows', () => {
      expect(schema.filterRow!({ action: 'Buy' })).toBe(true)
    })

    it('mapRow for "Buy" with US TREASURY BIL divides price by 100', () => {
      const result = schema.mapRow({
        date: '2024-01-05',
        action: 'Buy',
        symbol: 'BIL',
        description: 'US TREASURY BIL 0% 2025-01-15',
        quantity: '10',
        price: '99.75',
        'fees & comm': '0',
        amount: '9.975',
      })
      expect(result.price).toBe(0.9975)
    })
  })
})
