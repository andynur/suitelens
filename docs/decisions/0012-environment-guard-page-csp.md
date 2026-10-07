# ADR 0012 — Preserve the NetSuite favicon under page CSP

Status: accepted · Scope: Environment Guard CSP regression

## Context

The Environment Guard generated a canvas PNG as a `data:` URL and installed it as the page
favicon. NetSuite login pages can enforce `img-src 'self'`, rejecting that URL and reporting
an extension error. Loading the original favicon into an image can also conflict with the
page policy. Catching an image load error does not prevent the browser's CSP violation.

## Decision

Preserve the site's favicon and remove the canvas/image tinting path. Keep the environment
banner and per-account colors and labels. Restore favicon links left by older content scripts
when applying settings, including when the banner is enabled. Do not relax CSP or add new
extension permissions. Favicon tinting is deferred until a CSP-compatible approach is validated.

## Consequences and validation

Environment Guard provides its signal through the banner. Its Settings description and README
no longer advertise favicon tinting. Unit tests verify the original favicon survives and no
canvas or image is created, plus cleanup of legacy overrides. Fixture Chromium E2E uses a page
response with `Content-Security-Policy: img-src 'self'` and checks that settings updates preserve
the favicon without emitting a policy violation. Real-account validation remains manual.
