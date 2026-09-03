"""
Correlation / Portfolio Heat Map — Explore Concept #4
=========================================================

Computes pairwise correlation between symbols' or bots' return series,
so a trader running "5 diversified bots" can see whether they're
actually just placing the same bet five times. Flags pairs above a
configurable threshold as concentration risk — this is the standalone
version of the correlated-exposure check that was flagged back in the
core platform's risk engine as a Phase 3 "defer" item; here it's a
sellable tool in its own right.

Pure-Python Pearson correlation, no numpy dependency — keeps this
engine trivially portable into any environment without a numerical
stack already installed.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from typing import List


@dataclass
class ReturnSeries:
    label: str                 # symbol or bot_id
    returns: List[float]       # aligned by index — e.g. daily P&L or daily R, same period per series


@dataclass
class CorrelationFlag:
    label_a: str
    label_b: str
    correlation: float
    severity: str   # "high" | "moderate"


@dataclass
class CorrelationReport:
    labels: List[str]
    matrix: List[List[float]]         # NxN; matrix[i][j] = correlation(labels[i], labels[j])
    flags: List[CorrelationFlag] = field(default_factory=list)


class CorrelationEngine:
    def __init__(self, high_threshold: float = 0.7, moderate_threshold: float = 0.5):
        self.high_threshold = high_threshold
        self.moderate_threshold = moderate_threshold

    @staticmethod
    def _pearson(x: List[float], y: List[float]) -> float:
        n = min(len(x), len(y))
        if n < 2:
            return 0.0
        x, y = x[:n], y[:n]
        mean_x, mean_y = statistics.mean(x), statistics.mean(y)
        cov = sum((a - mean_x) * (b - mean_y) for a, b in zip(x, y))
        std_x = sum((a - mean_x) ** 2 for a in x) ** 0.5
        std_y = sum((b - mean_y) ** 2 for b in y) ** 0.5
        if std_x == 0 or std_y == 0:
            return 0.0
        return cov / (std_x * std_y)

    def compute(self, series_list: List[ReturnSeries]) -> CorrelationReport:
        if len(series_list) < 2:
            raise ValueError("Need at least 2 return series to compute correlation")

        labels = [s.label for s in series_list]
        n = len(series_list)
        matrix = [[0.0] * n for _ in range(n)]
        flags: List[CorrelationFlag] = []

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                    continue
                corr = round(self._pearson(series_list[i].returns, series_list[j].returns), 3)
                matrix[i][j] = corr
                if j > i:
                    abs_corr = abs(corr)
                    if abs_corr >= self.high_threshold:
                        flags.append(CorrelationFlag(labels[i], labels[j], corr, "high"))
                    elif abs_corr >= self.moderate_threshold:
                        flags.append(CorrelationFlag(labels[i], labels[j], corr, "moderate"))

        return CorrelationReport(labels=labels, matrix=matrix, flags=flags)
