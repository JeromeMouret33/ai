"""Rate limiting en mémoire, par utilisateur (Phase 4).

Fenêtre glissante simple, thread-safe. Protège les opérations coûteuses
(création de job, retry → appels OpenRouter payants).

Limite : mono-instance. Pour plusieurs instances backend, déporter vers Redis.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Callable


class RateLimiter:
    def __init__(
        self,
        max_calls: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self.clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """True si l'appel est autorisé (et le comptabilise), False si la limite est atteinte."""
        now = self.clock()
        with self._lock:
            dq = self._hits[key]
            while dq and now - dq[0] > self.window:
                dq.popleft()
            if len(dq) >= self.max_calls:
                return False
            dq.append(now)
            return True
