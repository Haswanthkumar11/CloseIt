"""
backend/services/llm.py
Backward-compatibility wrapper re-exporting run_agent_turn from backend/services/negotiation_engine.py.
"""

from backend.services.negotiation_engine import (
    run_agent_turn,
    fallback_keyword_classifier,
    build_system_prompt
)

__all__ = ["run_agent_turn", "fallback_keyword_classifier", "build_system_prompt"]
