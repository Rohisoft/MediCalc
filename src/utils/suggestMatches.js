// Ranks medicines by edit-distance similarity to a (possibly mis-heard or
// misspelled) name, for "Did you mean…" correction chips — used when
// fuzzyMatch finds no confident match at all.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function suggestMatches(name, medicines, limit = 3) {
  const q = (name || '').toLowerCase().trim();
  if (!q || medicines.length === 0) return [];
  return medicines
    .map((m) => ({ med: m, dist: levenshtein(q, m.name.toLowerCase()) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((x) => x.med);
}
