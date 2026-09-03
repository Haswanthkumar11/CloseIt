"""
backend/services/subscription_service.py
Deterministic recommendation engine for Smart Recharge plans.
Computes factual mathematical comparisons (price difference, validity gains, OTT benefits)
between a user's selected plan and available catalog alternatives.
"""

import logging
from typing import List, Dict, Any, Optional
from backend.db.mongo import get_recharge_plans_db

logger = logging.getLogger("closeit.subscription")

async def get_all_plans() -> List[Dict[str, Any]]:
    """Returns all active recharge plans from MongoDB or in-memory fallback."""
    plans = await get_recharge_plans_db()
    return [p for p in plans if p.get("active", True)]

async def get_plan_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a specific plan by its ID."""
    plans = await get_all_plans()
    for p in plans:
        if p["id"] == plan_id:
            return p
    return None

async def get_plan_recommendations(selected_plan_id: str) -> Dict[str, Any]:
    """
    Computes factual mathematical plan comparisons relative to selected_plan_id.
    Returns structured recommendations (Better Value, Cheaper, OTT Bundle) with factual reasons.
    """
    all_plans = await get_all_plans()
    selected_plan = None
    for p in all_plans:
        if p["id"] == selected_plan_id:
            selected_plan = p
            break
    
    if not selected_plan:
        # Fallback to standard bestseller if selected_plan_id is unknown
        selected_plan = all_plans[2] if len(all_plans) > 2 else all_plans[0]

    recommendations = []
    
    sel_price = float(selected_plan["price"])
    sel_validity = int(selected_plan["validity_days"])
    sel_ott = selected_plan.get("ott_benefits", [])

    for target in all_plans:
        if target["id"] == selected_plan["id"]:
            continue
            
        t_price = float(target["price"])
        t_validity = int(target["validity_days"])
        t_ott = target.get("ott_benefits", [])
        
        price_diff = t_price - sel_price
        validity_diff = t_validity - sel_validity
        
        # 1. Better Value Option (e.g. slight price increase for significant validity increase)
        if price_diff > 0 and price_diff <= 100 and validity_diff >= 14:
            recommendations.append({
                "plan": target,
                "recommendation_type": "BETTER_VALUE",
                "badge": "Double Value",
                "price_diff": price_diff,
                "validity_diff": validity_diff,
                "reason": f"₹{int(price_diff)} more for {validity_diff} additional days of validity",
                "value_score": round((t_validity / t_price) / (sel_validity / sel_price), 2)
            })
            
        # 2. Cheaper Option (e.g. lower price for same or comparable validity)
        elif price_diff < 0 and abs(price_diff) <= 150 and validity_diff >= -7:
            recommendations.append({
                "plan": target,
                "recommendation_type": "SAVE_MORE",
                "badge": "Save Money",
                "price_diff": price_diff,
                "validity_diff": validity_diff,
                "reason": f"₹{int(abs(price_diff))} cheaper with {target['validity_days']} days validity",
                "value_score": round((t_validity / t_price) / (sel_validity / sel_price), 2)
            })
            
        # 3. OTT Bundle Option
        elif len(t_ott) > len(sel_ott) and price_diff <= 150:
            ott_names = ", ".join(t_ott)
            recommendations.append({
                "plan": target,
                "recommendation_type": "OTT_UPGRADE",
                "badge": "Streaming Upgrade",
                "price_diff": price_diff,
                "validity_diff": validity_diff,
                "reason": f"Includes {len(t_ott)} OTT streaming apps ({ott_names}) for ₹{int(price_diff)} extra",
                "value_score": 1.25
            })

    # Deduplicate recommendations by type to keep top choice per category
    unique_recs = []
    seen_types = set()
    for rec in sorted(recommendations, key=lambda x: x["value_score"], reverse=True):
        rtype = rec["recommendation_type"]
        if rtype not in seen_types:
            seen_types.add(rtype)
            unique_recs.append(rec)
            
    return {
        "selected_plan": selected_plan,
        "recommendations": unique_recs[:3]
    }
