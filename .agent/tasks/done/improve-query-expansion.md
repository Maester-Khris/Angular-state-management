# Task: Scope-Constrain Query Expansion in `InferenceService`

## Scope
- [ ] Update `expand_query` in `InferenceService` to enforce tech/engineering domain scope
- [ ] Expansion must never drift into lifestyle, biology, philosophy, geography, or general knowledge
- [ ] Expanded query must remain useful for both Qdrant vector search and web search (SerpAPI)

## Role
Python LLM prompt engineer. You are modifying a production inference service. Do not change the method signature or return type. Do not touch any other method.

## Context

### Current problem
Query expansion for terms like "life" or "intelligence" produces expansions like:
```
"life definition biology psychology human existence"
"intelligence definition psychology cognitive abilities"
```
These are factually correct expansions but completely wrong for the platform domain. A user searching "life" on a tech platform means software lifecycle, service lifetime, TTL — not biology. The LLM has no domain context so it defaults to the most common general-knowledge interpretation.

### Platform domain
PostAir is a **software engineering and technology knowledge platform**. All content is written by and for software engineers. Valid topic areas:
- Software architecture & system design
- Web / mobile development
- Backend, APIs, databases
- DevOps, cloud, infrastructure
- AI/ML engineering (applied)
- Security, performance, developer tooling

### Method location
```
python-search-api/services/inference.py
InferenceService.expand_query(query: str, similar_docs: list) -> str
```

### Current prompt (approximate — agent must read actual file before editing)
The current prompt likely asks the LLM to expand the query without domain constraints.

## Task

### 1. Read the actual current prompt
Before writing anything, read `services/inference.py` to get the exact current `expand_query` prompt. Do not assume its content.

### 2. Update the system prompt
Replace or augment the system prompt with a hard domain constraint:
```python
SYSTEM_PROMPT = """You are a search query expansion assistant for a software engineering and technology platform.

Your only job is to expand a user's search query into a short list of related technical keywords that will improve search recall.

STRICT RULES:
- Output ONLY a space-separated list of keywords. No sentences, no punctuation, no explanation.
- Every keyword must be directly relevant to software engineering, computer science, or technology.
- If the query is ambiguous (e.g. "life", "intelligence", "memory"), interpret it in its SOFTWARE/ENGINEERING context:
    "life"        → software lifecycle, service uptime, TTL, reliability
    "intelligence" → artificial intelligence, ML systems, intelligent agents
    "memory"      → memory management, heap, garbage collection, caching
- NEVER expand into: biology, philosophy, geography, history, lifestyle, wellness, or any non-technical domain.
- Use the provided similar documents as additional context clues for the technical intent.
- Output 5–8 keywords maximum.
"""
```

### 3. Update the user prompt
```python
USER_PROMPT = f"""Query: "{query}"

Similar documents from our platform (use for context):
{similar_docs_text}

Expand this query into 5–8 technical keywords relevant to software engineering."""
```

Where `similar_docs_text` is a concise formatted string of the similar docs titles/descriptions — not the raw list object. Format it as:
```python
similar_docs_text = "\n".join(
    f"- {doc.get('title', '')}: {doc.get('description', '')[:100]}"
    for doc in (similar_docs or [])
) or "No similar documents found."
```

### 4. Guard the return value
After the LLM call, validate the output is a non-empty string before returning:
```python
expanded = response.strip()
if not expanded or len(expanded) < 3:
    return query  # fallback: return original query unchanged
return expanded
```

## Constraints
- Do not change the method signature: `expand_query(self, query: str, similar_docs: list) -> str` (or `async` if currently async — preserve as-is)
- Do not change any other method in `InferenceService`
- The fallback must always return the original `query` string, never `None`
- Read the actual file before editing — do not overwrite with assumptions

## Expected Output
1. Updated `services/inference.py` — `expand_query` method only

## Evaluation Checklist
- [ ] Query "life" expands to software-lifecycle-related keywords, not biology
- [ ] Query "intelligence" expands to AI/ML-related keywords, not psychology
- [ ] Query "memory" expands to memory management keywords, not neuroscience
- [ ] Expansion is a space-separated keyword string, not a sentence
- [ ] Return value is never `None` — falls back to original query on empty LLM response
- [ ] No other methods in `InferenceService` are modified
- [ ] `expand_query` method signature is unchanged

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: