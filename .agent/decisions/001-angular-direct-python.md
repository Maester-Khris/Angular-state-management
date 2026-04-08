# ADR-003: Angular calls Node for all Python endpoints

## Status: accepted

## Context
Angular was previously calling Python /search/ai directly.
The internal API key was visible in the browser network tab.

## Decision
All Python calls are proxied through Node.
Node holds the key in server environment variables.
Angular never has pythonBaseUrl or internalApiKey.

## Consequences
Extra ~10ms hop per AI search request.
Key never exposed to browser regardless of Angular code changes.