"""Shared Galileo KPI comments: API contract and SQL layer, with a fake warehouse."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import app
from galileo_dashboard import comments_store
from shared import auth

FLOW = "RX Lenses|Export Labs"
ALICE = "alice.rossi@luxottica.com"
BOB = "bob.bianchi@luxottica.com"


class FakeWarehouse:
    """Just enough of databricks-sql-connector for comments_store's four queries."""

    def __init__(self) -> None:
        self.rows: list[dict] = []
        self.queries: list[tuple[str, dict]] = []

    def connect(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return self

    def execute(self, query: str, params: dict) -> None:
        self.queries.append((query, dict(params)))
        q = " ".join(query.split())
        if q.startswith("SELECT id, flow"):
            ordered = sorted(self.rows, key=lambda r: r["created_at"], reverse=True)
            self._result = [
                (r["id"], r["flow"], r["market"], r["area"], r["author_email"], r["text"], r["created_at"])
                for r in ordered
            ]
        elif q.startswith("INSERT INTO"):
            self.rows.append({**params, "created_at": datetime.now(timezone.utc)})
            self._result = []
        elif q.startswith("SELECT author_email"):
            self._result = [(r["author_email"],) for r in self.rows if r["id"] == params["id"]]
        elif q.startswith("DELETE FROM"):
            self.rows = [
                r for r in self.rows
                if not (r["id"] == params["id"] and r["author_email"] == params["author_email"])
            ]
            self._result = []
        else:
            raise AssertionError(f"unexpected query: {q}")

    def fetchall(self):
        return self._result


class CommentsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        comments_store.invalidate()
        self.wh = FakeWarehouse()
        patches = [
            patch.object(comments_store, "_connect", self.wh.connect),
            patch.object(auth, "authorized", return_value=True),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.client = app.root.test_client()

    def post(self, body, email=ALICE):
        return self.client.post(
            "/galileo/api/comments", json=body, headers={"X-Forwarded-Email": email}
        )

    def valid(self, **over):
        return {"flow": FLOW, "market": "REP", "area": "EMEA", "text": "Batch size up", **over}

    def test_post_then_list_is_shared_across_users(self) -> None:
        created = self.post(self.valid())
        self.assertEqual(created.status_code, 201)
        comment = created.get_json()["comment"]
        self.assertEqual(comment["author"], "Alice Rossi")
        self.assertTrue(comment["mine"])

        seen_by_bob = self.client.get(
            "/galileo/api/comments",
            query_string={"flow": FLOW, "market": "REP"},
            headers={"X-Forwarded-Email": BOB},
        )
        self.assertEqual(seen_by_bob.status_code, 200)
        body = seen_by_bob.get_json()
        self.assertEqual(body["me"], "Bob Bianchi")
        self.assertEqual([c["text"] for c in body["comments"]], ["Batch size up"])
        self.assertFalse(body["comments"][0]["mine"])
        self.assertNotIn(ALICE, seen_by_bob.get_data(as_text=True))

    def test_list_is_scoped_by_flow_and_market(self) -> None:
        self.post(self.valid())
        self.post(self.valid(market="LM", text="LM note"))
        self.post(self.valid(flow="Frames|GV Frames*", text="Frames note"))
        body = self.client.get(
            "/galileo/api/comments", query_string={"flow": FLOW, "market": "LM"}
        ).get_json()
        self.assertEqual([c["text"] for c in body["comments"]], ["LM note"])

    def test_author_comes_from_identity_not_body(self) -> None:
        self.post(self.valid(author="Someone Else"))
        self.assertEqual(self.wh.rows[0]["author_email"], ALICE)

    def test_invalid_fields_are_rejected(self) -> None:
        for field, value in (
            ("market", "XX"),
            ("area", "MARS"),
            ("text", "   "),
            ("text", "x" * (comments_store.MAX_TEXT + 1)),
            ("flow", "no-separator"),
        ):
            with self.subTest(field=field, value=value[:20]):
                response = self.post(self.valid(**{field: value}))
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["field"], field)
        self.assertEqual(self.wh.rows, [])

    def test_post_requires_json(self) -> None:
        response = self.client.post(
            "/galileo/api/comments", data="flow=x&market=REP", content_type="application/x-www-form-urlencoded"
        )
        self.assertEqual(response.status_code, 415)
        self.assertEqual(self.wh.rows, [])

    def test_only_the_author_can_delete(self) -> None:
        comment_id = self.post(self.valid()).get_json()["comment"]["id"]
        forbidden = self.client.delete(
            f"/galileo/api/comments/{comment_id}", headers={"X-Forwarded-Email": BOB}
        )
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(len(self.wh.rows), 1)

        deleted = self.client.delete(
            f"/galileo/api/comments/{comment_id}", headers={"X-Forwarded-Email": ALICE}
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.wh.rows, [])

        missing = self.client.delete(
            f"/galileo/api/comments/{comment_id}", headers={"X-Forwarded-Email": ALICE}
        )
        self.assertEqual(missing.status_code, 404)

    def test_malformed_id_is_not_found_without_a_query(self) -> None:
        response = self.client.delete("/galileo/api/comments/not-an-id")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.wh.queries, [])

    def test_requires_galileo_grant(self) -> None:
        with patch.object(auth, "authorized", return_value=False):
            self.assertEqual(self.client.get("/galileo/api/comments").status_code, 403)
            self.assertEqual(self.post(self.valid()).status_code, 403)
            self.assertEqual(
                self.client.delete("/galileo/api/comments/" + "a" * 32).status_code, 403
            )
        self.assertEqual(self.wh.rows, [])

    def test_unreachable_table_is_503_not_empty(self) -> None:
        def down():
            raise RuntimeError("warehouse stopped")

        with patch.object(comments_store, "_connect", down):
            listed = self.client.get("/galileo/api/comments", query_string={"flow": FLOW, "market": "REP"})
            self.assertEqual(listed.status_code, 503)
            self.assertEqual(listed.get_json(), {"error": "comments_unavailable"})
            self.assertEqual(self.post(self.valid()).status_code, 503)

    def test_values_are_bound_parameters_and_table_is_quoted(self) -> None:
        self.post(self.valid(text="'); DROP TABLE x; --"))
        query, params = next(q for q in self.wh.queries if q[0].startswith("INSERT"))
        self.assertIn("`sbx-logistics`.`gli_nexus`.`galileo_comments`", query)
        self.assertNotIn("DROP", query)
        self.assertEqual(params["text"], "'); DROP TABLE x; --")

    def test_invalid_table_name_is_unavailable(self) -> None:
        with patch.dict(os.environ, {"GALILEO_COMMENTS_TABLE": "a.b.c`; DROP"}):
            self.assertEqual(self.post(self.valid()).status_code, 503)
        self.assertEqual(self.wh.queries, [])


class DisplayNameTests(unittest.TestCase):
    def test_display_name(self) -> None:
        self.assertEqual(comments_store.display_name("matteo.mamino@luxottica.com"), "Matteo Mamino")
        self.assertEqual(comments_store.display_name("local-dev"), "Local Dev")
        self.assertEqual(comments_store.display_name(None), "Unknown")


if __name__ == "__main__":
    unittest.main()
