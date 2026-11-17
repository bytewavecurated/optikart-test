"""Batch G infrastructure: rate limiters, DNS opt-in, JSON body limit.

Line-anchored, not whole-file regex. My previous attempt here matched across
statement boundaries and produced `authLimiterasync`, ate a preceding comment and
injected a stray `(p'` - nine damaged files, all caught by `node --check` and all
reverted. The routes in this codebase are declared on a single line
(`router.post('/login', async (req, res) => {`), so the honest transformation is
a per-line insertion after the path string, with the result verified by re-reading
from disk.
"""
import pathlib
import re

OTP = {"/verify-otp", "/verify-login-otp", "/resend-otp"}
AUTH = {"/login", "/register", "/forgot-password", "/reset-password"}

TARGETS = [
    "routes/auth.js",
    "routes/adminAuth.js",
    "routes/seller.js",
    "routes/manufacturer.js",
    "routes/manufacturerSeller.js",
    "routes/deliveryPartner.js",
    "routes/executive.js",
]

# matches a route declaration start, capturing the method, the path and the rest
LINE = re.compile(r"^(router\.(post|put|patch)\(\s*(['\"])([^'\"]+)\3)(,)((?:\s*[^,(]+,)*)\s*(async\s+\(|\(req)")

changed = {}
for rel in TARGETS:
    path = pathlib.Path(rel)
    lines = path.read_text().split("\n")
    added = []
    for i, line in enumerate(lines):
        m = LINE.match(line)
        if not m:
            continue
        route = m.group(4)
        needle = "/" + route.split("/")[-1]
        limiter = "otpLimiter" if needle in OTP else ("authLimiter" if needle in AUTH else None)
        if not limiter:
            continue
        middles = m.group(6) or ""
        if "Limiter" in middles or "verifyToken" in middles:
            continue
        indent = line[: len(line) - len(line.lstrip())]
        newline = f"{m.group(1)}, {limiter}{middles}{m.group(7)}{line[len(m.group(0)):]}"
        # sanity: the rewrite must keep the handler opening and add one token
        assert f", {limiter}" in newline, (rel, i, newline)
        assert "Limiterasync" not in newline and "(p'" not in newline, (rel, i, newline)
        assert newline.count("=> {") == line.count("=> {"), (rel, i, "handler shape changed")
        lines[i] = newline
        added.append((i + 1, needle, limiter))
    if not added:
        continue
    text = "\n".join(lines)
    names = sorted({lim for _, _, lim in added})
    existing = re.search(r"import \{([^}]*)\} from '\.\./middleware/rateLimiter\.js';", text)
    if existing:
        have = {x.strip() for x in existing.group(1).split(",") if x.strip()}
        merged = sorted(have | set(names))
        text = (
            text[: existing.start()]
            + f"import {{ {', '.join(merged)} }} from '../middleware/rateLimiter.js';"
            + text[existing.end() :]
        )
    else:
        anchor = re.search(r"^import express from 'express';$", text, re.M)
        assert anchor, f"{rel}: no import anchor"
        text = (
            text[: anchor.end()]
            + f"\nimport {{ {', '.join(names)} }} from '../middleware/rateLimiter.js';"
            + text[anchor.end() :]
        )
    path.write_text(text)
    changed[rel] = added

# ── verify every write by re-reading from disk ────────────────────────────────
for rel, added in changed.items():
    text = pathlib.Path(rel).read_text()
    for _line, needle, limiter in added:
        assert limiter in text, f"{rel}: {limiter} missing after write"
    assert "Limiterasync" not in text and "(p'" not in text, f"{rel}: corrupted"
    print(f"{rel:34} {len(added)} route(s): {', '.join(f'{n}->{l}' for _, n, l in added)}")

# ── DNS opt-in, both files ────────────────────────────────────────────────────
NOTE = """/*
 * DNS is left to the container unless explicitly overridden.
 *
 * `dns.setServers(['8.8.8.8','1.1.1.1'])` used to run unconditionally in server.js
 * AND seed.js, routing every hostname this process resolves through public
 * resolvers, past the deployment's own. Consequences: private zones (a VPC-internal
 * MongoDB, route53 private records) stop resolving, /etc/hosts is ignored, and an
 * environment with no direct DNS egress fails at resolution instead of at the
 * service it meant to reach. It existed to work around one container with a broken
 * resolv.conf, which is an infrastructure fix.
 *
 * DNS_OVERRIDE=8.8.8.8,1.1.1.1 reproduces the old behaviour, visibly and on
 * purpose.
 */
const dnsOverride = String(process.env.DNS_OVERRIDE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (dnsOverride.length) dns.setServers(dnsOverride);
"""
for rel in ["server.js", "seed.js"]:
    p = pathlib.Path(rel)
    text = p.read_text()
    needle = "dns.setServers(['8.8.8.8', '1.1.1.1']);"
    assert needle in text, f"{rel}: dns line not found"
    text = text.replace(needle, NOTE.strip(), 1)
    p.write_text(text)
    assert "DNS_OVERRIDE" in p.read_text() and "setServers(['8.8.8.8'" not in p.read_text()
    print(f"{rel:34} dns -> opt-in via DNS_OVERRIDE")

# ── JSON body limit ───────────────────────────────────────────────────────────
p = pathlib.Path("server.js")
text = p.read_text()
assert "express.json({ limit: '50mb' })" in text
assert "express.urlencoded({ extended: true, limit: '50mb' })" in text
decl = """/*
 * Uploads arrive as multipart with their own per-file cap (middleware/upload.js
 * `limits.fileSize`), so the JSON parser is sized for documents - a product, an
 * order, a list of ids. The previous 50mb applied to every route, which meant a
 * single unauthenticated POST could book 50mb of parse work: several of those is
 * an outage, and it was never protecting an upload.
 */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';

"""
marker = "app.use(cors({"
i = text.index(marker)
text = text[:i] + decl + text[i:]
text = text.replace("express.json({ limit: '50mb' })", "express.json({ limit: JSON_BODY_LIMIT })")
text = text.replace(
    "express.urlencoded({ extended: true, limit: '50mb' })",
    "express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT })",
)
p.write_text(text)
back = p.read_text()
assert "limit: JSON_BODY_LIMIT" in back and "50mb" not in back
print("server.js                            json body limit 50mb -> 1mb (env-tunable)")
print("\ndone")
