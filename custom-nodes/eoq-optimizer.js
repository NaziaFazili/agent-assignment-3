/**
 * Inventory Optimization Planner — Economic Order Quantity (EOQ).
 *
 * Pedagogical purpose
 * -------------------
 * EOQ (Wilson, 1934) is the canonical *classical* operations-research model:
 * a closed-form solution under strict assumptions —
 *   - constant demand
 *   - instantaneous replenishment
 *   - no stockouts allowed
 *   - fixed ordering cost, fixed holding cost
 *   - no quantity discounts
 *
 * Real e-commerce violates ALL of these for at least some SKUs. Viral
 * products (looking at you, SKU-007) blow past "constant demand." Discontinued
 * SKUs (SKU-013) make "no stockouts" expensive in the wrong direction.
 * Slow-movers make the formula numerically unstable.
 *
 * This node teaches the boundary problem: classical algorithms give crisp
 * answers exactly when their assumptions hold. Your two TODOs are
 *   (a) implement the formula
 *   (b) detect when its assumptions don't hold for a given SKU
 *
 * The downstream LLM exception node handles the SKUs you flag.
 *
 * Reading: docs/planning-primer.md §"STRIPS-style assumptions and where they break"
 */

// This node's direct input is the Master Planner's plan item (via the Switch),
// so the rows are read by node name: inventory rows ("Read Inventory JSON")
// and sales rows ("Read Sales JSON") are combined into one heterogeneous list.
// Partition them by which fields are present.
// CSV values arrive as strings: units_sold is converted to a number here;
// inventory fields (on_hand, lead_time_days, ...) still need Number().
const all = [
  ...$('Read Inventory JSON').all().map(i => i.json),
  ...$('Read Sales JSON').all()
    .map(i => ({ ...i.json, units_sold: Number(i.json.units_sold) })),
];

// Default ordering cost (S in the EOQ formula). In production this would
// vary by supplier and channel; we hard-code a single value so the focus
// stays on the formula and its assumptions.
const ORDERING_COST_USD = 50;

// ---- Helpers (provided) ---------------------------------------------------

function partition(rows) {
  const inventory = rows.filter(r => "on_hand" in r);
  const sales = rows.filter(r => "units_sold" in r);
  return { inventory, sales };
}

function annualDemand(salesForSku) {
  // Sum units_sold across the rows we have. With 12 months of data this is
  // the trailing-12-months annual demand.
  return salesForSku.reduce((acc, r) => acc + Number(r.units_sold), 0);
}

// ---- TODO #1 — the EOQ formula --------------------------------------------

/**
 * Wilson's Economic Order Quantity:
 *
 *   Q* = sqrt( (2 * D * S) / H )
 *
 * @param {number} D  Annual demand        (units per year)
 * @param {number} S  Fixed cost per order (dollars per order)
 * @param {number} H  Holding cost         (dollars per unit per year)
 * @returns {number}  Optimal order quantity, rounded to nearest integer.
 *
 * Hint: Math.sqrt is your friend. Guard against D=0 and H=0 — return 0 in
 *       either case. (You can't optimally order anything for zero demand,
 *       and dividing by zero holding cost is meaningless.)
 */
function eoq(D, S, H) {
  // LO-2: classical optimization
   if (D <= 0 || H <= 0 || S < 0) {
    return 0;
  }

  return Math.round(Math.sqrt((2 * D * S) / H));
}

// ----  #2 — assumption-violation detection -----------------------------
// Helper: calculate the average of a list of numbers.
  function average(values) {
    if (values.length === 0) return 0;

    let total = 0;

    for (const value of values) {
      total += value;
    }

    return total / values.length;
  }
/**
 * EOQ assumes:
 *   (a) demand is roughly constant
 *   (b) lead time is short enough to re-order before stocking out
 *   (c) the SKU isn't perishable (no holding-cost cliff)
 *   (d) demand volume is high enough that an "optimal batch" is meaningful
 *
 * Return an array of human-readable flag strings for any assumption that
 * FAILS for this SKU. An empty array means "EOQ is trustworthy here, ship
 * the formula's recommendation."
 *
 * Suggested checks (refine as you wish):
 *   - "viral_spike"   : mean(last 3 months) > 2.5 × mean(prior 9 months)
 *   - "declining"     : mean(last 3 months) < 0.5 × mean(first 3 months)
 *   - "low_velocity"  : annualDemand < 60   (less than ~5/month average)
 *   - "long_lead_time": inv.lead_time_days > 28 AND demand is volatile
 *
 * Note on perishability: none of our demo SKUs are perishable, so you do
 * NOT need a perishability check. Document the omission in your analysis
 * write-up — a real implementation would need it.
 *
 * @param {object} inv         Inventory row for the SKU
 * @param {Array}  salesSeries Chronologically sorted sales rows for the SKU
 * @returns {Array<string>}    Flag names, e.g. ["viral_spike", "low_velocity"]
 *
 * Hint: implement each check as its own small block. A flagged SKU may
 *       trigger multiple flags — that's expected and useful downstream.
 */
function detectViolations(inv, salesSeries) {
  //  knowing when classical models fail
    // Store warning messages for this product.
  const flags = [];

  // Get the sales numbers from oldest month to newest month.
  const sales = salesSeries.map(r => Number(r.units_sold));

  
  // 1. Check for a sudden sales increase.
  // We need 12 months: the latest 3 and the previous 9.
  if (sales.length >= 12) {
    const recentAverage = average(sales.slice(-3));
    const previousAverage = average(sales.slice(-12, -3));

    // If recent sales are more than 2.5 times the previous average,
    // the product may have a viral spike.
    if (
      previousAverage > 0 &&
      recentAverage > previousAverage * 2.5
    ) {
      flags.push("viral_spike");
    }
  }

  // 2. Check whether sales are declining.
  // Compare the first 3 months with the latest 3 months.
  if (sales.length >= 6) {
    const firstAverage = average(sales.slice(0, 3));
    const recentAverage = average(sales.slice(-3));

    // If recent sales are less than half the original average,
    // sales may be declining.
    if (
      firstAverage > 0 &&
      recentAverage < firstAverage * 0.5
    ) {
      flags.push("declining");
    }
  }

  // 3. Check for a slow-selling product.
  // If annual demand is less than 60 units, add a warning.
  const demand = annualDemand(salesSeries);

  if (demand < 60) {
    flags.push("low_velocity");
  }

  // 4. Check whether sales vary a lot from month to month.
  // Low CV → sales are relatively steady. High CV → sales fluctuate significantly.
  const mean = average(sales);
  let variance = 0;

  for (const units of sales) {
    variance += (units - mean) ** 2;
  }

  if (sales.length > 0) {
    variance = variance / sales.length;
  }

  // CV measures how much sales vary compared with their average.
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  // If delivery takes more than 28 days AND sales vary a lot,
  // add a warning because replenishment may be risky.
  const leadTime = Number(inv.lead_time_days);

  if (leadTime > 28 && cv > 0.5) {
    flags.push("long_lead_time");
  }

  // Return all warnings found for this product.
  return flags;
  
}

// ---- Main loop (provided) -------------------------------------------------

const { inventory, sales } = partition(all);
//This groups sales records by product SKU
const salesBySku = sales.reduce((acc, r) => {
  (acc[r.sku] = acc[r.sku] || []).push(r);
  return acc;
}, {});
//This visits each SKU group and sorts its sales records by month, from earliest to latest.
for (const sku of Object.keys(salesBySku)) {
  salesBySku[sku].sort((a, b) => a.month.localeCompare(b.month));
}

const results = [];
for (const inv of inventory) {
  const series = salesBySku[inv.sku] || [];
  const D = annualDemand(series);
  const H = Number(inv.holding_cost_per_unit_year);
  const Q = eoq(D, ORDERING_COST_USD, H);
  const flags = detectViolations(inv, series);

  results.push({
    sku: inv.sku,
    name: inv.name,
    on_hand: Number(inv.on_hand),
    reorder_point: Number(inv.reorder_point),
    annual_demand: D,
    eoq_units: Q,
    holding_cost_per_unit_year: H,
    ordering_cost_usd: ORDERING_COST_USD,
    assumption_flags: flags,
    needs_llm_review: flags.length > 0,
  });
}

return results.map(r => ({ json: r }));
