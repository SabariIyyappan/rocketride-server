# MIT License
#
# Copyright (c) 2026 Aparavi Software AG
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

from __future__ import annotations

"""
rocketride.analytics — anonymous distinct_id primitive.

WHO NEEDS THIS: only the raw ``client.report()`` capture path (product
servers, tools, and other non-browser hosts) needs to supply its own
``distinct_id``. This module owns id generation and the get-or-create
orchestration; each consumer owns persistence by implementing the tiny
``AnonIdStore`` protocol for its environment, so the module stays
side-effect-free and environment-agnostic.

WHY THIS IS SIMPLER THAN THE TYPESCRIPT SIBLING: the browser primitive
(``client/analytics/anonId.ts``) carries a crypto-source fallback because
``crypto.randomUUID()`` is gated to secure contexts, so it may be absent and
the code must fall back to ``crypto.getRandomValues()`` (and throw rather than
degrade to a weak PRNG). Python has no such gate: ``uuid.uuid4()`` is ALWAYS
available and is CSPRNG-backed (it draws from ``os.urandom``). There is
therefore no fallback and no throw path here — we preserve the identical
guarantee (crypto-strength ids, never a weak/collision-prone PRNG) with a
single unconditional call.
"""

import uuid
from typing import Protocol

#: Stable key/filename consumers should use for the persisted anon id.
ANON_ID_KEY = 'rr_anon_id'


def new_anon_id() -> str:
    """Generate a fresh anonymous id.

    Returns a canonical RFC 4122 version-4 UUID string produced by
    ``uuid.uuid4()``, which is CSPRNG-backed (sourced from ``os.urandom``).
    Unlike the browser sibling there is no fallback or throw path: this
    generator is always available and always cryptographically strong.
    """
    return str(uuid.uuid4())


class AnonIdStore(Protocol):
    """Persistence contract each consumer implements for its environment.

    Intentionally synchronous and minimal. Implementations back it with
    whatever durable store their host provides (a JSON file, a settings
    store, an in-memory object for the process lifetime, ...).
    """

    def get(self) -> str | None:
        """Return the persisted id, or ``None`` if none has been stored yet."""
        ...

    def set(self, anon_id: str) -> None:
        """Durably persist the id."""
        ...


def get_or_create_anon_id(store: AnonIdStore) -> str:
    """Return the caller's stable anonymous id, creating one on first use.

    Returns the stored id if the ``store`` already holds one; otherwise
    generates a fresh id via :func:`new_anon_id`, persists it through
    ``store.set(...)``, and returns it. This is the function product code
    calls to obtain the ``distinct_id`` for ``client.report()``.
    """
    existing = store.get()
    if existing:
        return existing
    anon_id = new_anon_id()
    store.set(anon_id)
    return anon_id
