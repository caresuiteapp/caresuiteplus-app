"""Independently verify CP295 by extending the unchanged CP294 restore verifier."""
from pathlib import Path

template_path = Path(__file__).with_name('verify-ambulant-checkpoint-cp294.py')
source = template_path.read_text()
replacements = [
    ('CP294', 'CP295', 1),
    ('cp294', 'cp295', 1),
    (
        "    'client-address-planning-evidence-web.node.test.mjs',\n",
        "    'client-address-planning-evidence-web.node.test.mjs',\n"
        "    'client-intake-identity-conflict-live-web.node.test.mjs',\n",
        1,
    ),
    ('pass 256', 'pass 264', 1),
    ('256/256', '264/264', 2),
    ("consistency['checkpoint'] != 294", "consistency['checkpoint'] != 295", 1),
    ("'checkpoint': 294", "'checkpoint': 295", 1),
]
for old, new, expected_count in replacements:
    actual_count = source.count(old)
    if actual_count != expected_count:
        raise SystemExit(
            f'CP294 verifier template changed for {old!r}: expected {expected_count}, got {actual_count}'
        )
    source = source.replace(old, new)

exec(compile(source, str(template_path), 'exec'), {'__name__': '__main__', '__file__': str(template_path)})
