import re
from functools import lru_cache
import inflect
import pysbd

_segmenter = pysbd.Segmenter(language="en", clean=False)
_numbers = inflect.engine()
_contractions = {"can't": "can not", "cannot": "can not", "won't": "will not", "i'm": "i am", "it's": "it is", "that's": "that is", "let's": "let us"}


def split_sentences(text: str) -> list[str]:
    return [s.strip() for paragraph in text.splitlines() if paragraph.strip() for s in _segmenter.segment(paragraph) if s.strip()]


@lru_cache(maxsize=2048)
def tokens(text: str) -> tuple[tuple[str, int, int], ...]:
    result = []
    for match in re.finditer(r"[A-Za-z]+(?:['’][A-Za-z]+)?|\d+(?:\.\d+)?", text):
        word = match.group().lower().replace("’", "'")
        if word[0].isdigit():
            word = _numbers.number_to_words(word, andword="")
        elif word in _contractions:
            word = _contractions[word]
        elif word.endswith("n't"):
            word = word[:-3] + " not"
        else:
            for ending, expanded in (("'re", " are"), ("'ve", " have"), ("'ll", " will")):
                if word.endswith(ending):
                    word = word[:-len(ending)] + expanded
                    break
        for part in re.findall(r"[a-z]+", word):
            result.append((part, match.start(), match.end()))
    return tuple(result)


def align(reference: str, transcript: str, words: list[dict] | None = None) -> list[dict]:
    """Stable word edit alignment; offsets refer to the original strings."""
    expected, actual = tokens(reference), tokens(transcript)
    n, m = len(expected), len(actual)
    # Among equal edit costs, prefer retaining more exact matches. This avoids
    # cascading substitutions around repeated words and one omitted word.
    penalty = n + m + 1
    if n * m > 4_000_000:
        raise ValueError("Sentence too long to align; split it into shorter practice units.")
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i * penalty
    for j in range(m + 1):
        d[0][j] = j * penalty
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i][j] = min(d[i-1][j]+penalty, d[i][j-1]+penalty, d[i-1][j-1]+(penalty if expected[i-1][0] != actual[j-1][0] else -1))
    operations = []
    i, j = n, m
    while i or j:
        if i and j and expected[i-1][0] == actual[j-1][0] and d[i][j] == d[i-1][j-1] - 1:
            operations.append(("match", i-1, j-1))
            i, j = i-1, j-1
        elif j and d[i][j] == d[i][j-1] + penalty:
            operations.append(("insert", None, j-1))
            j -= 1
        elif i and j and d[i][j] == d[i-1][j-1] + penalty:
            operations.append(("substitute", i-1, j-1))
            i, j = i-1, j-1
        elif i and d[i][j] == d[i-1][j] + penalty:
            operations.append(("omit", i-1, None))
            i -= 1
        else:
            raise ValueError("Invalid alignment state.")
    timing = []
    for word in words or []:
        for _ in tokens(word["word"]):
            timing.append({"start": word.get("start"), "end": word.get("end")})
    return [{"type": op, "expected": expected[a][0] if a is not None else None,
             "actual": actual[b][0] if b is not None else None,
             "reference_span": list(expected[a][1:]) if a is not None else None,
             "transcript_span": list(actual[b][1:]) if b is not None else None,
             "time": timing[b] if b is not None and b < len(timing) else None}
            for op, a, b in reversed(operations)]
