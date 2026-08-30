# Bootstrap confidence intervals for per-query metric arrays -- addresses the golden-set-rebuild
# audit's "point estimates only, no variance reporting" finding. Pure, no I/O.

import random


def bootstrap_ci(values: list[float], n_resamples: int = 1000, ci: float = 0.95, seed: int = 0) -> tuple[float, float, float]:
    """Returns (mean, ci_low, ci_high) via percentile bootstrap. (0.0, 0.0, 0.0) for empty input."""
    if not values:
        return (0.0, 0.0, 0.0)

    rng = random.Random(seed)
    n = len(values)
    mean = sum(values) / n

    resample_means = []
    for _ in range(n_resamples):
        resample = [values[rng.randrange(n)] for _ in range(n)]
        resample_means.append(sum(resample) / n)
    resample_means.sort()

    alpha = (1 - ci) / 2
    lo_idx = int(alpha * n_resamples)
    hi_idx = int((1 - alpha) * n_resamples) - 1
    return (round(mean, 4), round(resample_means[lo_idx], 4), round(resample_means[hi_idx], 4))
