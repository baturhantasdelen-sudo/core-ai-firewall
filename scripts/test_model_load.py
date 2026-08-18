#!/usr/bin/env python3
"""One-off diagnostic: model + reference matrix load timing."""
import time

t0 = time.time()

print("step1: import SentenceTransformer")
from sentence_transformers import SentenceTransformer

print(f"step1 done in {time.time() - t0:.1f}s")

print("step2: load model")
model = SentenceTransformer(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    local_files_only=True,
)
print(f"step2 done in {time.time() - t0:.1f}s")

print("step3: load npy")
import numpy as np

matrix = np.load("/app/.cache/reference_matrix.npy")
print(f"step3 done shape={matrix.shape} in {time.time() - t0:.1f}s")

print("step4: encode probe")
vec = model.encode("warmup", convert_to_numpy=True, show_progress_bar=False)
print(f"step4 done dim={len(vec)} in {time.time() - t0:.1f}s")
print("ALL OK")
