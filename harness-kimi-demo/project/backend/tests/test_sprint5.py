import pytest
from app.models.collection import Collection
from app.models.collection_collaborator import CollectionCollaborator
from app.models.follow import Follow
from app.models.digest_item import DigestItem
from app.models.bookmark import Bookmark
from app.models.user import User


def test_visibility_toggle(client, auth_headers, db):
    # Create a collection
    r = client.post("/api/collections", json={"name": "Test Coll", "rules": {"operator": "AND", "conditions": []}}, headers=auth_headers)
    assert r.status_code == 201
    coll_id = r.json()["id"]

    # Toggle visibility
    r = client.patch(f"/api/collections/{coll_id}", json={"visibility": "public_readonly"}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["visibility"] == "public_readonly"

    r = client.patch(f"/api/collections/{coll_id}", json={"visibility": "shared_edit"}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["visibility"] == "shared_edit"


def test_public_share_link(client, auth_headers, db):
    r = client.post("/api/collections", json={"name": "Public Coll", "rules": {"operator": "AND", "conditions": []}}, headers=auth_headers)
    assert r.status_code == 201
    coll_id = r.json()["id"]

    # Make public and share
    client.patch(f"/api/collections/{coll_id}", json={"visibility": "public_readonly"}, headers=auth_headers)
    r = client.post(f"/api/collections/{coll_id}/share", headers=auth_headers)
    assert r.status_code == 200
    token = r.json()["share_token"]
    assert token

    # Access without auth
    r = client.get(f"/api/public/collections/{token}")
    assert r.status_code == 200
    assert r.json()["name"] == "Public Coll"


def test_revoke_share_link(client, auth_headers, db):
    r = client.post("/api/collections", json={"name": "Revoke Coll", "rules": {"operator": "AND", "conditions": []}}, headers=auth_headers)
    coll_id = r.json()["id"]
    client.patch(f"/api/collections/{coll_id}", json={"visibility": "public_readonly"}, headers=auth_headers)
    r = client.post(f"/api/collections/{coll_id}/share", headers=auth_headers)
    token = r.json()["share_token"]

    r = client.delete(f"/api/collections/{coll_id}/share", headers=auth_headers)
    assert r.status_code == 200

    r = client.get(f"/api/public/collections/{token}")
    assert r.status_code == 404


def test_collaborator_invite_and_edit(client, auth_headers, db):
    # Register collaborator first
    client.post("/api/auth/register", json={"email": "collab@example.com", "password": "password"})

    # Owner creates collection and bookmark
    r = client.post("/api/collections", json={"name": "Shared Coll", "rules": {"operator": "AND", "conditions": [{"field": "tag", "op": "equals", "value": "python"}]}}, headers=auth_headers)
    coll_id = r.json()["id"]
    client.patch(f"/api/collections/{coll_id}", json={"visibility": "shared_edit"}, headers=auth_headers)

    # Create bookmark
    r = client.post("/api/bookmarks", json={"url": "https://github.com/repo", "title": "Repo", "tags": ["python"]}, headers=auth_headers)
    bm_id = r.json()["id"]

    # Invite collaborator
    r = client.post(f"/api/collections/{coll_id}/collaborators", json={"email": "collab@example.com"}, headers=auth_headers)
    assert r.status_code == 200
    collab_user_id = r.json()["user_id"]

    # Collaborator login
    r = client.post("/api/auth/login", json={"email": "collab@example.com", "password": "password"})
    collab_token = r.json()["access_token"]
    collab_headers = {"Authorization": f"Bearer {collab_token}"}

    # Collaborator can edit bookmark that matches collection rules
    r = client.patch(f"/api/bookmarks/{bm_id}", json={"title": "Updated Repo"}, headers=collab_headers)
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Repo"


def test_collaborator_removal(client, auth_headers, db):
    # Register collaborator first
    client.post("/api/auth/register", json={"email": "remove@example.com", "password": "password"})

    r = client.post("/api/collections", json={"name": "Remove Coll", "rules": {"operator": "AND", "conditions": [{"field": "tag", "op": "equals", "value": "python"}]}}, headers=auth_headers)
    coll_id = r.json()["id"]
    client.patch(f"/api/collections/{coll_id}", json={"visibility": "shared_edit"}, headers=auth_headers)

    r = client.post("/api/bookmarks", json={"url": "https://github.com/repo", "title": "Repo", "tags": ["python"]}, headers=auth_headers)
    bm_id = r.json()["id"]

    r = client.post(f"/api/collections/{coll_id}/collaborators", json={"email": "remove@example.com"}, headers=auth_headers)
    collab_user_id = r.json()["user_id"]

    # Remove collaborator
    r = client.delete(f"/api/collections/{coll_id}/collaborators/{collab_user_id}", headers=auth_headers)
    assert r.status_code == 204

    # Collaborator can no longer edit
    r = client.post("/api/auth/login", json={"email": "remove@example.com", "password": "password"})
    collab_token = r.json()["access_token"]
    collab_headers = {"Authorization": f"Bearer {collab_token}"}
    r = client.patch(f"/api/bookmarks/{bm_id}", json={"title": "Hacked"}, headers=collab_headers)
    assert r.status_code == 403


def test_discovery_feed_ordering(client, auth_headers, db):
    # Create a second user with public collections
    client.post("/api/auth/register", json={"email": "discover@example.com", "password": "password"})
    r = client.post("/api/auth/login", json={"email": "discover@example.com", "password": "password"})
    other_token = r.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    r = client.post("/api/collections", json={"name": "Public A", "rules": {"operator": "AND", "conditions": []}}, headers=other_headers)
    coll_a = r.json()["id"]
    client.patch(f"/api/collections/{coll_a}", json={"visibility": "public_readonly"}, headers=other_headers)
    client.post(f"/api/collections/{coll_a}/share", headers=other_headers)

    r = client.post("/api/collections", json={"name": "Public B", "rules": {"operator": "AND", "conditions": []}}, headers=other_headers)
    coll_b = r.json()["id"]
    client.patch(f"/api/collections/{coll_b}", json={"visibility": "public_readonly"}, headers=other_headers)
    client.post(f"/api/collections/{coll_b}/share", headers=other_headers)

    # Have auth_headers user follow collection A
    coll_a_obj = db.query(Collection).filter(Collection.id == coll_a).first()
    client.post(f"/api/public/collections/{coll_a_obj.share_token}/follow", headers=auth_headers)

    # Discovery feed
    r = client.get("/api/discover", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    # A should be first because it has 1 follower, B has 0
    assert data[0]["name"] == "Public A"
    assert data[1]["name"] == "Public B"


def test_follow_unfollow_user(client, auth_headers, db):
    client.post("/api/auth/register", json={"email": "followtarget@example.com", "password": "password"})
    target_user = db.query(User).filter(User.email == "followtarget@example.com").first()
    target_id = target_user.id

    r = client.post(f"/api/users/{target_id}/follow", headers=auth_headers)
    assert r.status_code == 200

    r = client.get("/api/follows", headers=auth_headers)
    assert r.status_code == 200
    follows = r.json()
    assert any(f["followingUserId"] == target_id for f in follows)

    r = client.delete(f"/api/users/{target_id}/follow", headers=auth_headers)
    assert r.status_code == 204

    r = client.get("/api/follows", headers=auth_headers)
    assert not any(f["followingUserId"] == target_id for f in r.json())


def test_follow_public_collection(client, auth_headers, db):
    r = client.post("/api/auth/register", json={"email": "pubowner@example.com", "password": "password"})
    other_token = r.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    r = client.post("/api/collections", json={"name": "Followable", "rules": {"operator": "AND", "conditions": []}}, headers=other_headers)
    coll_id = r.json()["id"]
    client.patch(f"/api/collections/{coll_id}", json={"visibility": "public_readonly"}, headers=other_headers)
    client.post(f"/api/collections/{coll_id}/share", headers=other_headers)

    coll = db.query(Collection).filter(Collection.id == coll_id).first()
    r = client.post(f"/api/public/collections/{coll.share_token}/follow", headers=auth_headers)
    assert r.status_code == 200

    r = client.get("/api/follows", headers=auth_headers)
    assert any(f["followingCollectionId"] == coll_id for f in r.json())


def test_digest_generation(client, auth_headers, db):
    # Register follower and target
    r = client.post("/api/auth/register", json={"email": "digesttarget@example.com", "password": "password"})
    target_token = r.json()["access_token"]
    target_headers = {"Authorization": f"Bearer {target_token}"}
    target_user = db.query(User).filter(User.email == "digesttarget@example.com").first()
    target_id = target_user.id

    r = client.post("/api/auth/register", json={"email": "digestfollower@example.com", "password": "password"})
    follower_token = r.json()["access_token"]
    follower_headers = {"Authorization": f"Bearer {follower_token}"}
    follower_user = db.query(User).filter(User.email == "digestfollower@example.com").first()
    follower_id = follower_user.id

    # Follow target
    client.post(f"/api/users/{target_id}/follow", headers=follower_headers)

    # Target creates bookmark
    r = client.post("/api/bookmarks", json={"url": "https://example.com/digest", "title": "Digest Test"}, headers=target_headers)
    bm_id = r.json()["id"]

    # Follower should have digest item
    r = client.get("/api/digest", headers=follower_headers)
    assert r.status_code == 200
    items = r.json()
    assert any(i["bookmarkId"] == bm_id for i in items)
