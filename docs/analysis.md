# Assignment 3: Intelligent E-commerce Supply Chain Manager

**UCLA Extension - Agentic AI Course · Week 3: Planning & Reasoning**

## Algorithm comparison
### 1. SKU-012:
    Classical Baseline Forecast: 82 units
    The classical algorithm predicted 82 units using the three-month moving average (83 units) multiplied by the seasonal index (0.99). Since the seasonal index is close to 1, there is no significant seasonal change in demand. The statistical confidence is high at 0.97, suggesting the historical sales pattern is relatively stable.The output also includes a note about a planned 20% promotional discount.

    LLM-Revised Forecast: 98 units
    The LLM increased the forecast from 82 to 98 units, an increase of 19.51%. The adjustment was based on a planned 20% promotional discount for Bluetooth Buds which was included in the notes. The LLM reasoned that the discount could attract more customers and increase sales. 

    Which Forecast Would I Trust?
    I would lean toward the LLM-revised forecast because the classical algorithm does not account for the upcoming promotion in its calculation.

### 2. SKU-007 — Wool Gloves:
    Classical Baseline Forecast: 354 units
    The classical algorithm predicted 354 units using the three-month moving average (376.7) multiplied by the seasonal index (0.94). The statistical confidence is very low at 0.25, indicating that the forecast may not be reliable due to inconsistent sales patterns.

    LLM-Revised Forecast: 354 units
    The LLM kept the forecast unchanged because no additional promotions or market events, were provided. Although it recognized the low statistical confidence, it did not have enough information to justify an adjustment.

    Which Forecast Would I Trust?
    I would use the classical forecast as a starting point since the LLM did not identify any reason to change it.

## EOQ assumption analysis

The flags which are implemented in detectViolations() function are:
1. viral_spike is triggered when the recent three month average sales are more than 2.5 times the previous nine month average, indicating a sudden increase in demand.
This flag was triggered for SKU-007.
For SKU-007 (Wool Gloves), the LLM recommended ordering 600 units instead of the usual 431 because demand is increasing quickly, delivery takes longer, and only 18 units are left in stock.
I agree that more stock should be ordered quickly to avoid running out. 

2. Declining  is flagged when the recent three month average falls below 50% of the first three month average, showing a significant drop in sales. 
This flag was triggered for SKU-013.
For SKU-013 (Wired Earbuds), the LLM recommended not ordering more because sales are dropping and there are already 540 units in stock. It suggested offering discounts if sales continue to fall.
I agree because ordering more when sales are low could lead to extra stock and higher storage costs.

3. low_velocity is triggered when annual demand is below 60 units, meaning the product sells very slowly.
This flag was not triggered for any SKU.

4. long_lead_time is flagged when supplier delivery takes more than 28 days and demand is unpredictable, increasing the risk of stock shortages.
This flag was triggered for SKU-005, SKU-006, SKU-007, and SKU-009. 
For SKU-005, the LLM recommended holding off on new orders because there are 140 units in stock, well above the reorder point of 30. Although supplier delivery takes longer, there is enough stock for now.
I agree because there is no immediate need to reorder. However, the supplier's delivery time and demand changes should be monitored to avoid future shortages.

## Supplier rubric defense
DTC company which is an e-commerce business, has assigned the following weights to evaluate suppliers:

* Reliability: 35% — The highest weight because products need to arrive on time to avoid delays and unhappy customers.

* Quality: 25% — Good quality is important to reduce defective products, returns, and customer complaints.

* Cost: 20% — Longer payment terms help the company manage cash flow, but reliability and quality are more important.

* Lead Time: 20% — Faster deliveries help maintain inventory and avoid running out of stock.

For this company reliability and quality make up 60% because for this type of business, on-time delivery and product quality are important. Delays and defective products can lead to unhappy customers, returns, and lost sales and less revenue. A hospital supply chain would likely also give importance to quality and reliability because defective or delayed medical supplies could affect patient safety.

In my supplier evaluation, SUP-001 (GreenLeaf Goods) ranked highest with a score of 73.1, mainly because of strong reliability, good quality, and the shortest delivery time. SUP-002 (Pacific Rim Trading) ranked lowest with a score of 25.0 because of poor reliability and quality. I agree with these rankings because, for an e-commerce business, delivering good-quality products on time is more important than getting longer payment terms(cost).

## Run metrics

| Run | Branch | Total tokens | Approx. cost | Duration |
| -------- | -------- | -------- |-------- | -------- |
| 1 | Forecast | 11,128 | $0.03 | 16.07 sec |
| 2 | Inventory | 12,954 | $0.08 | 19.83 sec |
| 3 | Supplier | 4,121 | $0.05 | 24.03 sec |

I tested the workflow three times using the Forecast, Inventory, and Supplier Evaluation branches.

The Forecast run used 11,128 tokens and took 16.07 seconds. The Inventory run used the most tokens (12,954) and took 19.83 seconds. The Supplier run used the fewest tokens (4,121) but took the longest at 24.03 seconds.

One thing that surprised me was the high token usage for Inventory and Forecast because the LLM processed all 15 SKUs individually. Another interesting observation was that the Supplier run took the longest despite using the fewest tokens.

## Reflection on the four primer questions
1. Where in your workflow does a classical algorithm produce a wrong answer that the LLM catches, and where does the LLM produce a wrong answer that the classical layer catches?
Classical algorithm mistake caught by the LLM: In the Inventory workflow, the EOQ algorithm recommended a standard order quantity of 431 units for SKU-007 (Wool Gloves). However, demand was increasing rapidly, stock was low, and supplier delivery was slow. The LLM recognized these issues and recommended ordering 647 units instead.
LLM mistake caught by the classical layer: didnt find one but in the Supplier Evaluation workflow, the LLM sometimes calculated incorrect supplier scores even though the formulas were clearly defined. 

2. If your Master Planner started emitting next_subgoal: "audit_warehouse" (a value the Switch doesn't know about), what would happen, and what change would you make to the workflow so that wasn't a silent failure?
If the Master Planner returns next_subgoal: "audit_warehouse", the Switch node would not recognize it, so the workflow might stop without running any branch. To prevent this silent failure, I would add a fallback output to the Switch node to catch unknown values.

3. Why does EOQ give a confident, wrong answer for SKU-013 (Wired Earbuds), and what flag in your detectViolations() should fire to keep that from going to production?
EOQ gives a misleading answer for SKU-013 (Wired Earbuds) because it assumes demand is stable, but sales are actually declining. It calculates an order quantity without considering the falling sales or the 540 units already in stock. This could lead to excess inventory and higher storage costs. The declining flag in detectViolations() should catch this problem

4. Why is supplier scoring an LLM job and EOQ a classical job? What would change if I asked you to swap them?
Supplier scoring uses an LLM because it can compare supplier performance, explain strengths and weaknesses, and recommend improvements. EOQ uses a classical algorithm because it follows a fixed mathematical formula and needs accurate calculations.

## Demo video
https://www.loom.com/share/7cb7a0c2a635426ebfb98dfdd927611a