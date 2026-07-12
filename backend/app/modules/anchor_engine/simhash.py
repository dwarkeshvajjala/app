def hamming_distance(hex_a: str, hex_b: str) -> int:
    return bin(int(hex_a, 16) ^ int(hex_b, 16)).count("1")


def similarity(hex_a: str, hex_b: str, *, bits: int = 64) -> float:
    """1.0 = identical SimHash, 0.0 = maximally different (all bits differ). The SDK
    computes these (apps/widget/src/simhash.ts) over character trigrams, not words -
    short UI text (button labels) doesn't have enough word-level shingles for SimHash's
    bit-vote to discriminate reliably; trigrams give even a two-word label dozens of
    overlapping shingles."""
    return 1 - (hamming_distance(hex_a, hex_b) / bits)
