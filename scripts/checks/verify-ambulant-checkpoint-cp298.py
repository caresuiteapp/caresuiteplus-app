"""Independently verify CP298 by extending the unchanged CP294 restore verifier."""
from pathlib import Path

template_path = Path(__file__).with_name('verify-ambulant-checkpoint-cp294.py')
source = template_path.read_text()
replacements = [
    ('CP294', 'CP298', 1),
    ('cp294', 'cp298', 1),
    (
        "    'client-address-planning-evidence-web.node.test.mjs',\n",
        "    'client-address-planning-evidence-web.node.test.mjs',\n"
        "    'client-intake-identity-conflict-live-web.node.test.mjs',\n"
        "    'client-contact-access-separation-live-web.node.test.mjs',\n"
        "    'client-medical-contacts-live-web.node.test.mjs',\n"
        "    'client-diagnosis-notes-live-web.node.test.mjs',\n",
        1,
    ),
    ('pass 256', 'pass 291', 1),
    ('256/256', '291/291', 2),
    ("consistency['checkpoint'] != 294", "consistency['checkpoint'] != 298", 1),
    ("'checkpoint': 294", "'checkpoint': 298", 1),
]
for old, new, expected_count in replacements:
    actual_count = source.count(old)
    if actual_count != expected_count:
        raise SystemExit(
            f'CP294 verifier template changed for {old!r}: expected {expected_count}, got {actual_count}'
        )
    source = source.replace(old, new)

exec(compile(source, str(template_path), 'exec'), {'__name__': '__main__', '__file__': str(template_path)})
