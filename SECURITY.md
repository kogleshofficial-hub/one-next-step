# Security Policy

## Reporting a vulnerability

Please do not disclose sensitive security details in a public issue.

For a suspected vulnerability, contact the project owner through the contact method listed on the project's public profile and include:

- A concise description of the issue
- The affected route, component, or behavior
- Reproduction steps when available
- The potential impact

Never include passwords, API keys, tokens, or other private credentials in a report.

## Security principles

One Next Step should:

- Validate untrusted input at the API boundary
- Keep secrets server-side
- Validate structured AI output before returning it to clients
- Apply sensible request-size and rate protections
- Avoid committing local configuration or credentials
- Keep dependencies and CI tooling maintained
