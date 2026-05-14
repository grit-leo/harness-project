import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
import app.models  # noqa: ensure models register with metadata
from main import app as fastapi_app

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _auth_headers(client: TestClient, email: str = "test@example.com", password: str = "password"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    del fastapi_app.dependency_overrides[get_db]


@pytest.fixture
def auth_headers(client):
    return _auth_headers(client)


@pytest.fixture(autouse=True)
def patch_ai_service_session(db, monkeypatch):
    class SessionWrapper:
        def __getattr__(self, name):
            attr = getattr(db, name)
            if name == "close":
                return lambda: None
            return attr

    class FakeSessionLocal:
        def __call__(self):
            return SessionWrapper()

    monkeypatch.setattr("app.services.ai_service.SessionLocal", FakeSessionLocal())
