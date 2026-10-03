import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from .text import split_sentences


def identifier():
    return uuid.uuid4().hex


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path):
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS objects (id TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(id,kind))")
        columns = self.db.execute("PRAGMA table_info(objects)").fetchall()
        if sum(bool(c[5]) for c in columns) == 1:
            self.db.execute("CREATE TABLE objects_v2 (id TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(id,kind))")
            self.db.execute("INSERT INTO objects_v2 SELECT * FROM objects")
            self.db.execute("DROP TABLE objects")
            self.db.execute("ALTER TABLE objects_v2 RENAME TO objects")
        self.db.commit()

    def put(self, kind, body):
        with self.lock, self.db:
            self.db.execute("INSERT OR REPLACE INTO objects VALUES (?,?,?)", (body["id"], kind, json.dumps(body)))
        return body

    def get(self, kind, id):
        with self.lock:
            row = self.db.execute("SELECT body FROM objects WHERE id=? AND kind=?", (id, kind)).fetchone()
        if not row:
            raise KeyError(id)
        return json.loads(row[0])

    def list(self, kind):
        with self.lock:
            return [json.loads(row[0]) for row in self.db.execute("SELECT body FROM objects WHERE kind=? ORDER BY rowid DESC", (kind,)).fetchall()]

    def delete(self, kind, id):
        with self.lock, self.db:
            self.db.execute("DELETE FROM objects WHERE id=? AND kind=?", (id, kind))

    def sentence(self, session_id, text, original=None, options=None):
        return self.put("sentence", {"id": identifier(), "session_id": session_id, "version": 1,
                         "original_text": original if original is not None else text, "spoken_text": text,
                         "options": options or {"provider": "kokoro", "voice": "af_sarah", "speed": 1, "style": ""}, "asset_id": None})

    def create_session(self, title, text):
        parts = split_sentences(text)
        if not parts:
            raise ValueError("Text must contain a sentence.")
        if any(len(p) > 10_000 for p in parts):
            raise ValueError("A sentence exceeds 10,000 characters. Add punctuation or line breaks.")
        id = identifier()
        sentences = [self.sentence(id, p) for p in parts]
        return self.put("session", {"id": id, "title": title, "original_text": text, "created_at": now(),
                                   "sentence_ids": [s["id"] for s in sentences], "current_sentence_id": sentences[0]["id"]})

    def detail(self, id):
        session = self.get("session", id)
        session["sentences"] = [self.get("sentence", s) for s in session["sentence_ids"]]
        return session

    def edit_sentence(self, id, text, options):
        with self.lock:
            sentence = self.get("sentence", id)
            if text != sentence["spoken_text"] or options != sentence["options"]:
                sentence.update(spoken_text=text, options=options, version=sentence["version"]+1, asset_id=None)
                self.put("sentence", sentence)
            return sentence

    def split(self, id, offset):
        with self.lock:
            sentence = self.get("sentence", id)
            if not 0 < offset < len(sentence["spoken_text"]):
                raise ValueError("Split position must be inside the sentence.")
            left, right = sentence["spoken_text"][:offset].strip(), sentence["spoken_text"][offset:].strip()
            if not left or not right:
                raise ValueError("Both split sentences must contain text.")
            # Preserve the full original text even when pronunciation edits change character lengths.
            child = self.sentence(sentence["session_id"], right, "", sentence["options"])
            self.edit_sentence(id, left, sentence["options"])
            session = self.get("session", sentence["session_id"])
            session["sentence_ids"].insert(session["sentence_ids"].index(id)+1, child["id"])
            self.put("session", session)
            return self.detail(session["id"])

    def merge(self, id):
        with self.lock:
            sentence = self.get("sentence", id)
            session = self.get("session", sentence["session_id"])
            index = session["sentence_ids"].index(id)
            if index + 1 >= len(session["sentence_ids"]):
                raise ValueError("No following sentence to merge.")
            next_id = session["sentence_ids"].pop(index+1)
            other = self.get("sentence", next_id)
            combined = sentence["spoken_text"] + " " + other["spoken_text"]
            if len(combined) > 10_000:
                raise ValueError("Merged sentence exceeds 10,000 characters.")
            sentence = self.edit_sentence(id, combined, sentence["options"])
            sentence["original_text"] = (sentence["original_text"] + " " + other["original_text"]).strip()
            self.put("sentence", sentence)
            if session["current_sentence_id"] == next_id:
                session["current_sentence_id"] = id
            self.put("session", session)
            # Keep archived sentence for recording history and in-flight job references.
            return self.detail(session["id"])
