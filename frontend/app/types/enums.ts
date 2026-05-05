export enum Bank {
  Chase = 'Chase',
  Schwab = 'Schwab',
  Fidelity = 'Fidelity',
  ETrade = 'ETrade',
  Other = 'Other'
}

export enum AccountType {
  Taxable = 'Taxable',
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  k401 = '401k',
  HSA = 'HSA',
  Plan529 = '529'
}

export enum SyncMethod {
  Manual = 'Manual',
  SchwabAPI = 'SchwabAPI',
  CSVImport = 'CSVImport'
}

export enum TransactionType {
  Buy = 'Buy',
  Sell = 'sell',
  Dividend = 'Dividend',
  Split = 'Split',
  Transfer = 'Transfer'
}

export enum AssetType {
  Stock = 'Stock',
  Bond = 'Bond',
  ETF = 'ETF',
  MutualFund = 'MutualFund',
  Cash = 'Cash',
  Crypto = 'Crypto'
}

export enum CostBasisMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  SpecificLot = 'SpecificLot',
  AverageCost = 'AverageCost'
}
