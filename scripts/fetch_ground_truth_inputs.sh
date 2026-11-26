#!/usr/bin/env bash
# Fetch exact, versioned evidence without relying on expiring Actions artifacts.
# Run from an authenticated gh session with read access to amydojo/anatomy-lab.
set -euo pipefail
repo=amydojo/anatomy-lab
tag=archive-unity-53bd624-1d7f8d54
out="${1:-ground-truth-inputs}"
mkdir -p "$out"
fetch() {
  local asset="$1" digest="$2" target="$3"
  if [[ ! -f "$target" ]]; then
    local tmp
    tmp="$(mktemp "$out/.download.XXXXXX")"
    rm "$tmp"
    gh release download "$tag" --repo "$repo" --pattern "$asset" --output "$tmp"
    echo "$digest  $tmp" | sha256sum -c
    mv "$tmp" "$target"
  fi
  echo "$digest  $target" | sha256sum -c
}
fetch unity-source-53bd624-1d7f8d54.zip 1d7f8d54a5c683ac6f675a2495cb32585dc1d097058fd0f683418db6808ea58e "$out/unity.zip"
fetch ground-truth-headers-53bd624-ac3b87c9.zip ac3b87c981cfeba43953c9e1f6eaba9d6c27ebbbb0065c3405b0128d7b0d215a "$out/headers.zip"
