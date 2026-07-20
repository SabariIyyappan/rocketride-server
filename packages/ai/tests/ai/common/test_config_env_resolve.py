"""Unit tests for ${ROCKETRIDE_*} placeholder resolution in Config.getNodeConfig.

Pins the fix for issue #1105: an apikey field set via the env-var autocomplete
(e.g. "${ROCKETRIDE_ANTHROPIC_KEY}") must never reach a node's validateConfig()/
beginGlobal() as a literal, unresolved string -- callers that skip pipeline-level
resolution (e.g. the engine's live validateConfig probe) previously sent the raw
placeholder to the provider SDK, producing a silent 401.

Loaded by file path with rocketlib/json5 stubbed so no engine runtime is needed --
mirrors the approach in test_config_shapes.py.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types
from pathlib import Path
from unittest.mock import patch

_CONFIG_PATH = Path(__file__).resolve().parents[3] / 'src' / 'ai' / 'common' / 'config.py'

_SERVICE = {
    'preconfig': {
        'default': 'default',
        'profiles': {
            'default': {'apikey': '', 'model': 'claude'},
        },
    }
}


def _load_config():
    """Load config.py with rocketlib/json5 stubbed; patch getServiceDefinition."""
    saved = {k: sys.modules.get(k) for k in ('rocketlib', 'json5')}

    rl = types.ModuleType('rocketlib')

    class _IJson:
        @staticmethod
        def toDict(x):
            return dict(x) if isinstance(x, dict) else x

    rl.IJson = _IJson
    rl.warning = lambda *a, **k: None
    rl.getServiceDefinition = lambda logical_type: _SERVICE
    sys.modules['rocketlib'] = rl
    sys.modules['json5'] = types.ModuleType('json5')

    try:
        spec = importlib.util.spec_from_file_location('rr_real_config_env_resolve', _CONFIG_PATH)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.Config
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v


Config = _load_config()


class TestApiKeyPlaceholderResolution:
    def test_allowed_placeholder_resolves(self):
        with patch.dict(os.environ, {'ROCKETRIDE_ANTHROPIC_KEY': 'sk-ant-real-key'}):
            cfg = Config.getNodeConfig('llm_anthropic', {'apikey': '${ROCKETRIDE_ANTHROPIC_KEY}'})
            assert cfg['apikey'] == 'sk-ant-real-key'

    def test_missing_placeholder_left_as_is(self):
        cfg = Config.getNodeConfig('llm_anthropic', {'apikey': '${ROCKETRIDE_MISSING_KEY}'})
        assert cfg['apikey'] == '${ROCKETRIDE_MISSING_KEY}'

    def test_disallowed_var_redacted_not_leaked(self):
        with patch.dict(os.environ, {'AWS_SECRET_ACCESS_KEY': 'super-secret'}):
            cfg = Config.getNodeConfig('llm_anthropic', {'apikey': '${AWS_SECRET_ACCESS_KEY}'})
            assert cfg['apikey'] == '<REDACTED>'

    def test_plain_apikey_unchanged(self):
        cfg = Config.getNodeConfig('llm_anthropic', {'apikey': 'sk-ant-literal'})
        assert cfg['apikey'] == 'sk-ant-literal'

    def test_nested_profile_shape_resolves(self):
        with patch.dict(os.environ, {'ROCKETRIDE_ANTHROPIC_KEY': 'sk-ant-real-key'}):
            cfg = Config.getNodeConfig(
                'llm_anthropic',
                {'profile': 'default', 'default': {'apikey': '${ROCKETRIDE_ANTHROPIC_KEY}'}},
            )
            assert cfg['apikey'] == 'sk-ant-real-key'
