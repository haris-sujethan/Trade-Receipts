#!/bin/sh
# Assembles backend/.vercel-build/: the API's code, its serving-only requirements and the ~20 MB of data
# live checks read, then deploys it to Vercel (the data never goes into Git). Run from backend/:
#   sh deploy/package.sh            build the folder only
#   sh deploy/package.sh --deploy   build, then deploy to production with the Vercel CLI
set -e
cd "$(dirname "$0")/.."
OUT=.vercel-build
DATA=../data
rm -rf "$OUT/api" "$OUT/receipts" "$OUT/data"
mkdir -p "$OUT/api" "$OUT/data/models/baselines" "$OUT/data/reports"

rsync -a --exclude __pycache__ receipts "$OUT/"
cp deploy/index.py "$OUT/api/index.py"
uv run python -c "from receipts.crypto import baselines; baselines.export_trees()"
cp "$DATA/models/baselines/lightgbm.json" "$DATA/models/baselines/lightgbm_calibration.json" "$OUT/data/models/baselines/"
cp -R "$DATA/idl" "$DATA/demo" "$OUT/data/"
for b in may aug sep; do
  mkdir -p "$OUT/data/pump/dataset/$b"
  cp "$DATA/pump/dataset/$b/snapshots.parquet" "$OUT/data/pump/dataset/$b/"
done
uv export --no-hashes --no-default-groups --no-dev --format requirements-txt | grep -v '^ *#' | sed 's/ *;.*//' > "$OUT/requirements.txt"
echo "3.12" > "$OUT/.python-version"
cat > "$OUT/vercel.json" <<'JSON'
{
  "functions": { "api/index.py": { "maxDuration": 300, "includeFiles": "{receipts,data}/**" } }
}
JSON
du -sh "$OUT"
if [ "$1" = "--deploy" ]; then
  cd "$OUT" && npx --yes vercel@latest deploy --prod
fi
