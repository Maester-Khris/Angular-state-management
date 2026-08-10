import pytest
import os
import sys
from unittest.mock import MagicMock

# Add the parent directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Env defaults must be set before `from app import app` below — app.py constructs
# its services (including ExaWebSearchAdapter, which raises if EXA_API_KEY is
# missing) at module level, which runs before any pytest fixture ever gets a
# chance to execute, session-scoped or not.
os.environ['NODE_SHARED_SECURITY_KEY'] = os.getenv('NODE_SHARED_SECURITY_KEY', 'test-key')
os.environ['NODE_SERVICE_URL'] = os.getenv('NODE_SERVICE_URL', 'http://test-node')
os.environ['GROQ_API_KEY'] = os.getenv('GROQ_API_KEY', 'test-groq-key')
os.environ['EXA_API_KEY'] = os.getenv('EXA_API_KEY', 'test-exa-key')

from app import app as flask_app

@pytest.fixture
def client():
    """Provide a Flask test client."""
    flask_app.config['TESTING'] = True
    # Refresh INTERNAL_API_KEY in the app modules if necessary
    import app
    app.INTERNAL_API_KEY = os.environ['NODE_SHARED_SECURITY_KEY']
    
    with flask_app.test_client() as client:
        yield client

@pytest.fixture
def auth_headers():
    """Provide valid authentication headers matching the environment."""
    return {"X-Internal-Key": os.environ['NODE_SHARED_SECURITY_KEY']}

@pytest.fixture(autouse=True)
def mock_embedding_svc(mocker):
    """Mocks the EmbeddingService on the app instance."""
    mock = MagicMock()
    mocker.patch('app.search_svc', mock)
    return mock

@pytest.fixture(autouse=True)
def mock_inference_svc(mocker):
    """Mocks the InferenceService on the app instance."""
    mock = MagicMock()
    # Mock both sync and async methods as MagicMock handles both fine for patch
    mocker.patch('app.llm_svc', mock)
    return mock

@pytest.fixture(autouse=True)
def mock_websearch_svc(mocker):
    """Mocks the WebSearchService on the app instance."""
    mock = MagicMock()
    mocker.patch('app.websearch_svc', mock)
    return mock

# Shared Mock Data
@pytest.fixture
def fake_qdrant_docs():
    return [
        {"uuid": "uuid-1", "title": "AI in Healthcare", "description": "Overview of ML in medicine", "score": 0.91},
        {"uuid": "uuid-2", "title": "Deep Learning Basics", "description": "Intro to neural nets", "score": 0.87},
        {"uuid": "uuid-3", "title": "NLP Transformers", "description": "BERT and GPT explained", "score": 0.83},
    ]

@pytest.fixture
def fake_web_results():
    """websearch_svc.search() returns list[WebResult] (search_providers' own
    value object) — not the pre-Exa SerpAPI dict shape."""
    from services.search_providers.base import WebResult
    return [
        WebResult(title="AI News", url="https://ainews.com", favicon="https://ainews.com/favicon.ico", snippet="Latest AI research"),
        WebResult(title="ML Weekly", url="https://mlweekly.com", favicon="https://mlweekly.com/favicon.ico", snippet="Weekly ML digest"),
        WebResult(title="Papers With Code", url="https://paperswithcode.com", favicon="https://paperswithcode.com/favicon.ico", snippet="ML papers"),
    ]

@pytest.fixture
def fake_structured_sources():
    return [
        {"source_name": "AI News", "source_url": "https://ainews.com", "source_small_headline": "Top AI resource", "source_small_description": "Latest research", "favicon": "https://ainews.com/favicon.ico"},
        {"source_name": "ML Weekly", "source_url": "https://mlweekly.com", "source_small_headline": "ML digest", "source_small_description": "Weekly updates", "favicon": "https://mlweekly.com/favicon.ico"},
    ]
