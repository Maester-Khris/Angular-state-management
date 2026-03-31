# Task: Reseed `posts_to_seed.json` with On-Scope Content

## Scope
- [ ] Replace all entries in the `postTemplates` array inside `posts_to_seed.json`
- [ ] Every post must be strictly within: software engineering, web development, DevOps, system design, AI/ML engineering, developer tooling, programming languages, computer science fundamentals
- [ ] Zero lifestyle, travel, wellness, van life, cooking, fitness, or general-interest content

## Role
Technical content writer and data engineer. You are reseeding a vector search database used by a tech/engineering platform. The quality of search results depends entirely on the topical consistency of seeded content.

## Context

### Why this matters
The Qdrant vector search and the LLM query expansion both learn topical scope from seeded content. Off-topic seeds (van life, cooking, etc.) pollute the embedding space and cause query expansion to drift toward non-engineering topics, degrading search relevance for the platform's actual users.

### Current problem
`postTemplates` contains posts like "Van Life Reality #37" and similar lifestyle content that has no place on a tech/engineering platform. These posts bias semantic search results and query expansion.

### File location
```
python-search-api/seeders/posts_to_seed.json
```

### Current structure (preserve exactly)
```json
{
  "postTemplates": [
    {
      "title": "...",
      "description": "..."
    }
  ]
}
```

## Task

Replace the `postTemplates` array with **at minimum 30 posts** covering the following topic distribution:

| Topic area | Min posts |
|---|---|
| System design & architecture | 5 |
| Web frontend (Angular, React, etc.) | 4 |
| Backend & APIs (Node, Python, REST, GraphQL) | 4 |
| DevOps, CI/CD, containers | 4 |
| AI / ML engineering (not theory — applied) | 4 |
| Database & search (SQL, NoSQL, vector DBs) | 4 |
| Computer science fundamentals (algorithms, data structures) | 3 |
| Developer experience & tooling | 3 |
| Security (AppSec, auth, encryption) | 3 |

### Content rules per post
- `title`: concise, practitioner-focused (e.g. "Designing Idempotent APIs", not "What is an API?")
- `description`: 1–2 sentences, technical, written from a practitioner's perspective
- No motivational language ("unlock your potential", "transform your career")
- No beginner clickbait ("10 things every developer must know")
- Reads like a post a senior engineer would write and a mid-level engineer would learn from

### Example of acceptable post
```json
{
  "title": "Rate Limiting Strategies for High-Traffic APIs",
  "description": "Comparing token bucket, leaky bucket, and sliding window algorithms for API rate limiting, with implementation notes for Node.js and Redis."
}
```

### Example of rejected post
```json
{
  "title": "Van Life Reality #37",
  "description": "The pros and cons of living and working from a converted van."
}
```

## Constraints
- Do not change the JSON file structure — only replace the array contents
- No duplicate titles
- All descriptions must be unique
- Output must be valid JSON (run through a linter mentally before writing)

## Expected Output
1. Updated `posts_to_seed.json` with 30+ on-scope entries

## Evaluation Checklist
- [ ] Zero lifestyle / travel / wellness posts in the array
- [ ] Every post title reads like something a software engineer would search for
- [ ] JSON is valid and parseable
- [ ] At least 30 entries
- [ ] No two entries share the same title or near-identical description

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: