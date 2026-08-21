from eval_stats import bootstrap_ci


def test_bootstrap_ci_constant_values_has_zero_width():
    mean, lo, hi = bootstrap_ci([0.5, 0.5, 0.5, 0.5], n_resamples=200, seed=1)
    assert mean == 0.5 and lo == 0.5 and hi == 0.5


def test_bootstrap_ci_bounds_contain_mean():
    values = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8]
    mean, lo, hi = bootstrap_ci(values, n_resamples=500, seed=1)
    assert lo <= mean <= hi


def test_bootstrap_ci_is_deterministic_given_seed():
    values = [0.1, 0.4, 0.6, 0.9]
    a = bootstrap_ci(values, n_resamples=300, seed=42)
    b = bootstrap_ci(values, n_resamples=300, seed=42)
    assert a == b


def test_bootstrap_ci_empty_values_returns_zeros():
    assert bootstrap_ci([], n_resamples=100, seed=1) == (0.0, 0.0, 0.0)
