from backend.pipeline import cost
from backend.rate_limit import RateLimiter


# --- Coûts / usage ---
def test_extract_usage_full():
    data = {"model": "openai/gpt-4o-mini",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5,
                      "total_tokens": 15, "cost": 0.0012}}
    u = cost.extract_usage(data)
    assert u == {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15,
                 "cost": 0.0012, "model": "openai/gpt-4o-mini"}


def test_extract_usage_missing_defaults_to_zero():
    u = cost.extract_usage({})
    assert u["prompt_tokens"] == 0 and u["cost"] == 0.0 and u["total_tokens"] == 0


def test_merge_usage_sums():
    a = cost.extract_usage({"usage": {"total_tokens": 3, "cost": 0.001}})
    b = cost.extract_usage({"model": "m", "usage": {"total_tokens": 7, "cost": 0.002}})
    m = cost.merge_usage(a, b)
    assert m["total_tokens"] == 10
    assert round(m["cost"], 6) == 0.003
    assert m["model"] == "m"


# --- Rate limiter (horloge injectable) ---
def test_rate_limiter_blocks_after_max():
    t = [0.0]
    rl = RateLimiter(max_calls=3, window_seconds=60, clock=lambda: t[0])
    assert all(rl.allow("user") for _ in range(3))   # 3 autorisés
    assert rl.allow("user") is False                 # 4e bloqué
    # Un autre utilisateur n'est pas impacté.
    assert rl.allow("autre") is True


def test_rate_limiter_window_slides():
    t = [0.0]
    rl = RateLimiter(max_calls=2, window_seconds=60, clock=lambda: t[0])
    assert rl.allow("u") and rl.allow("u")
    assert rl.allow("u") is False
    t[0] = 61.0  # la fenêtre a glissé
    assert rl.allow("u") is True
