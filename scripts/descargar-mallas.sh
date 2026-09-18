#!/usr/bin/env bash
# Descarga y extrae las mallas de "Brain for Blender" (Anderson Winkler, CC BY-SA 3.0)
# https://brainder.org/research/brain-for-blender/
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/raw"
BASE="https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles"
mkdir -p "$DIR"
cd "$DIR"
for f in pial_DK_obj subcortical_obj; do
  if [ ! -d "$f" ]; then
    echo "Descargando $f.tar.bz2 ..."
    curl -sSL -o "$f.tar.bz2" "$BASE/$f.tar.bz2"
    tar -xjf "$f.tar.bz2"
  else
    echo "$f ya existe, se omite."
  fi
done
echo "Mallas OBJ disponibles: $(find . -name '*.obj' | wc -l | tr -d ' ')"
