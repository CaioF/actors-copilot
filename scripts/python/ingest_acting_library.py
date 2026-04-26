#!/usr/bin/env python3
"""Ingest the acting library corpus into Pinecone using integrated embedding.

Install deps (from scripts/python/):
  ./venv/bin/pip install pinecone python-dotenv

Required .env vars:
  PINECONE_API_KEY=<from pinecone.io dashboard>
  PINECONE_INDEX_HOST=<host URL from Pinecone dashboard → index → Connection tab>

Index prerequisites — the index MUST be created with integrated embedding enabled:
  - model: llama-text-embed-v2 (configured at index creation)
  - field_map: {"text": "text"}  ← the field name in records below MUST be "text"

The record field "text" MUST match the embed.field_map value configured above.
"""

import os
from pathlib import Path
from dotenv import dotenv_values

env = dotenv_values(Path(__file__).resolve().parent.parent.parent / ".env")

for var in ["PINECONE_API_KEY", "PINECONE_INDEX_HOST"]:
    if not env.get(var):
        raise RuntimeError(f"Missing required env var: {var} — see script docstring")

PINECONE_API_KEY = env["PINECONE_API_KEY"]
PINECONE_INDEX_HOST = env["PINECONE_INDEX_HOST"]
CORPUS_DIR = env.get("ACTING_COACH_CORPUS_DIR", "./book_sources")
CORPUS_PATH = os.path.join(CORPUS_DIR, "sources_open.txt")

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
TOP_K = 5
NAMESPACE = "__default__"
BATCH_SIZE = 96


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into chunks on word boundaries, preserving coherence for embedding."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].rstrip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
    return chunks


def main():
    from pinecone import Pinecone

    if not os.path.exists(CORPUS_PATH):
        raise FileNotFoundError(f"Corpus file not found: {CORPUS_PATH}")

    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        content = f.read().strip()

    if not content:
        raise ValueError("Corpus file is empty")

    source_book = os.path.basename(CORPUS_PATH)
    chunks = chunk_text(content)
    print(f"[ingest] {source_book}: {len(chunks)} chunks produced")

    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(host=PINECONE_INDEX_HOST)

    records = [
        {
            "_id": f"{source_book}#{i}",
            "text": chunk,
            "source": source_book,
            "chunk_index": i,
        }
        for i, chunk in enumerate(chunks)
    ]

    print(f"[ingest] Upserting {len(records)} records to Pinecone...")
    try:
        total_upserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            response = index.upsert_records(NAMESPACE, records=batch)
            total_upserted += getattr(response, "upserted_count", len(batch))
        print(f"[ingest] Done. {total_upserted}/{len(records)} records upserted.")
    except Exception as exc:
        print(f"[ingest] ERROR: Upsert failed: {exc}")
        raise

    print(f"[ingest] Running search smoke-test...")
    results = index.search(
        namespace=NAMESPACE,
        query={"inputs": {"text": "acting techniques"}, "top_k": TOP_K},
        fields=["text", "source"],
    )
    hits = results.result.hits
    print(f"[ingest] Search test returned {len(hits)} results")
    for hit in hits[:3]:
        print(f"  - score={hit._score:.4f}  {hit._id}  text={hit.fields.get('text', 'N/A')[:60]}...")


if __name__ == "__main__":
    main()
