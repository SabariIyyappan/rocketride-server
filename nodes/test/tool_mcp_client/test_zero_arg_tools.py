"""Tests for zero-argument MCP tool handling (issue #1404).

Reasoning-model agents silently drop a tool whose input schema has no
``properties``. The MCP client now normalizes such schemas to carry a single
synthesized optional no-op field (``rr_no_args``) so strict models keep the
tool, and strips that field again before the real ``tools/call``.

Covers:
- ``normalize_tool_input_schema`` (pure) — every degenerate schema shape.
- ``strip_synthesized_args`` (pure) — the exact helper the invoke path uses.
- End-to-end against a stub stdio MCP server: discovery shapes + that the
  synthesized field never reaches the server.
"""

import os
import sys

import pytest

# Import the node modules the same way the sibling test_sse_redirect.py does:
# add the node source dir to sys.path and import the transport standalone.
_NODE_SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'nodes', 'tool_mcp_client')
sys.path.insert(0, _NODE_SRC)

from mcp_schema import NOOP_ARG_NAME, normalize_tool_input_schema, strip_synthesized_args  # noqa: E402
from mcp_stdio_client import McpStdioClient  # noqa: E402

STUB_SERVER = os.path.join(os.path.dirname(__file__), 'stub_mcp_server.py')


# ---------------------------------------------------------------------------
# normalize_tool_input_schema — pure unit tests
# ---------------------------------------------------------------------------


class TestNormalizeSchema:
    def _assert_synthesized(self, schema):
        props = schema.get('properties')
        assert isinstance(props, dict)
        assert list(props.keys()) == [NOOP_ARG_NAME]
        assert props[NOOP_ARG_NAME]['type'] == 'string'
        assert schema['type'] == 'object'
        assert schema.get('required') == []

    def test_none_is_synthesized(self):
        self._assert_synthesized(normalize_tool_input_schema(None))

    def test_non_dict_is_synthesized(self):
        self._assert_synthesized(normalize_tool_input_schema('not-a-schema'))
        self._assert_synthesized(normalize_tool_input_schema(123))

    def test_bare_object_is_synthesized(self):
        # The exact shape the transports used to default to.
        self._assert_synthesized(normalize_tool_input_schema({'type': 'object'}))

    def test_explicit_empty_properties_is_synthesized(self):
        self._assert_synthesized(normalize_tool_input_schema({'type': 'object', 'properties': {}, 'required': []}))

    def test_non_empty_properties_passes_through_unchanged(self):
        original = {
            'type': 'object',
            'properties': {'msg': {'type': 'string'}},
            'required': ['msg'],
        }
        result = normalize_tool_input_schema(original)
        assert result is original  # untouched, same object
        assert NOOP_ARG_NAME not in result['properties']

    def test_preserves_extra_schema_keys(self):
        result = normalize_tool_input_schema({'type': 'object', 'title': 'Foo', 'description': 'bar'})
        assert result['title'] == 'Foo'
        assert result['description'] == 'bar'
        self._assert_synthesized(result)


# ---------------------------------------------------------------------------
# strip_synthesized_args — pure unit tests (the exact invoke-path helper)
# ---------------------------------------------------------------------------


class TestStripSynthesizedArgs:
    def test_strips_noop_key(self):
        assert strip_synthesized_args({NOOP_ARG_NAME: 'whatever', 'a': 1}) == {'a': 1}

    def test_strips_when_only_noop(self):
        assert strip_synthesized_args({NOOP_ARG_NAME: ''}) == {}

    def test_leaves_real_args_untouched(self):
        args = {'a': 1, 'b': 2}
        assert strip_synthesized_args(args) == {'a': 1, 'b': 2}

    def test_empty_dict_unchanged(self):
        assert strip_synthesized_args({}) == {}

    def test_non_dict_unchanged(self):
        assert strip_synthesized_args(None) is None
        assert strip_synthesized_args('x') == 'x'


# ---------------------------------------------------------------------------
# End-to-end against the stub stdio MCP server
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    c = McpStdioClient(command=sys.executable, args=[STUB_SERVER], timeout_s=10.0)
    c.start()
    try:
        yield c
    finally:
        c.stop()


class TestStubIntegration:
    def test_zero_arg_tools_get_nonempty_properties(self, client):
        tools = {t.name: t for t in client.list_tools()}
        assert set(tools) == {'no_schema_tool', 'empty_props_tool', 'echo_tool'}

        # Both zero-argument shapes are normalized to a non-empty properties map
        # carrying the synthesized no-op field.
        for name in ('no_schema_tool', 'empty_props_tool'):
            props = tools[name].inputSchema.get('properties')
            assert isinstance(props, dict) and props, f'{name} still has empty properties'
            assert NOOP_ARG_NAME in props, f'{name} missing synthesized arg'

    def test_real_arg_tool_schema_untouched(self, client):
        tools = {t.name: t for t in client.list_tools()}
        echo = tools['echo_tool'].inputSchema
        assert set(echo['properties']) == {'msg'}
        assert NOOP_ARG_NAME not in echo['properties']

    def test_synthesized_arg_never_reaches_server(self, client):
        # Simulate the invoke path: a model fills in the presentation-only no-op
        # field; the node strips it before dispatching to the MCP server.
        model_args = strip_synthesized_args({NOOP_ARG_NAME: 'ignored'})
        result = client.call_tool(name='no_schema_tool', arguments=model_args)
        assert result['received_arguments'] == {}

    def test_empty_call_succeeds(self, client):
        result = client.call_tool(name='empty_props_tool', arguments={})
        assert result['received_arguments'] == {}

    def test_real_args_pass_through(self, client):
        result = client.call_tool(name='echo_tool', arguments={'msg': 'hi'})
        assert result['received_arguments'] == {'msg': 'hi'}
