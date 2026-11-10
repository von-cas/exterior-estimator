// Shared types for the estimating engine. Lengths are feet, areas square feet,
// window sizes inches, money integer cents. The engine does no I/O.

export const TRADES = ["roofing", "siding", "windows", "gutters"] as const;
export type Trade = (typeof TRADES)[number];

export type RuleType = "area" | "linear" | "per_spacing" | "per_count" | "per_item" | "fixed";

export interface WindowItem {
  width: number; // inches
  height: number; // inches
  count: number;
}

export interface Measurements {
  /** Named values, for example roof_area or eaves. null means "not known yet". */
  values: Record<string, number | null>;
  windows: WindowItem[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  trade: Trade;
  role: string;
  /** Purchase unit, for example "bundle", "piece", "box", "each". */
  unit: string;
  /** How much one purchase unit covers: sq ft for area rules, ft for linear rules. */
  coverage: number | null;
  supplier: string;
  unitCost: number; // cents
}

export interface TemplateLine {
  key: string;
  trade: Trade;
  role: string;
  label: string;
  rule: RuleType;
  /** Measurement the rule reads. Not used by fixed or per_item. */
  measurement?: string;
  waste?: number; // 0.10 = 10%
  spacing?: number; // feet, per_spacing
  qtyEach?: number; // per_count
  quantity?: number; // fixed
  /** per_item: picks a product role by the item's united inches. */
  bands?: { maxUnitedInches: number; role: string }[];
  /** Hidden from the customer's estimate (nails, sealant); still costed and ordered. */
  productionOnly?: boolean;
}

export interface LaborLine {
  key: string;
  trade: Trade;
  task: string;
  label: string;
  /** Measurement the labor is charged on, or "window_count". */
  measurement: string;
  /** Divide the measurement by this first, for example 100 to charge per roofing square. */
  per?: number;
  /** Optional measurement that multiplies the quantity, for example tear_off_layers. */
  times?: string;
}

export interface LaborRate {
  trade: Trade;
  task: string;
  unit: string;
  rate: number; // cents per unit
}

export interface EstimateInputs {
  trades: Trade[];
  measurements: Measurements;
  template: TemplateLine[];
  labor: LaborLine[];
  products: Product[];
  laborRates: LaborRate[];
  /** Chosen product id per role. A role with no choice uses the first product with that role. */
  selections?: Record<string, string>;
  /** Waste per template line key, overriding the template default. */
  wasteOverrides?: Record<string, number>;
  /** Gross margin per trade, 0.35 = 35%. */
  margins: Record<Trade, number>;
}

export type IssueLevel = "blocking" | "warning";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  lineKey?: string;
}

export interface MaterialLine {
  key: string;
  trade: Trade;
  label: string;
  productId: string;
  sku: string;
  productName: string;
  supplier: string;
  unit: string;
  quantity: number; // purchase units, whole numbers
  unitCost: number;
  cost: number;
  productionOnly: boolean;
  /** Explains the number, for example "2,318 sq ft × 1.10 ÷ 33.3 = 76.6 → 77". */
  workings: string;
  /** Cannot go on a purchase order until a field measure is recorded. */
  lockedForPurchase: boolean;
}

export interface LaborItem {
  key: string;
  trade: Trade;
  label: string;
  quantity: number;
  unit: string;
  rate: number;
  cost: number;
  workings: string;
}

export interface TradeTotal {
  trade: Trade;
  materialCost: number;
  laborCost: number;
  cost: number;
  margin: number;
  markup: number;
  price: number;
}

export interface EstimateResult {
  materials: MaterialLine[];
  labor: LaborItem[];
  trades: TradeTotal[];
  totalCost: number;
  totalPrice: number;
  issues: Issue[];
}
