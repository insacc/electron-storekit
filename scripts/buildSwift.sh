#!/bin/sh
# Builds the Swift bridge as a universal (arm64 + x86_64) static library, so
# the addon links on either architecture node-gyp targets.
set -eu

output="$1"
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$output"

for arch in arm64 x86_64; do
  mkdir -p "$output/$arch"
  swiftc -parse-as-library -emit-library -static -O \
    -module-name StoreKitBridge -swift-version 5 \
    -target "$arch-apple-macos13.0" \
    "$root"/swift/*.swift \
    -o "$output/$arch/libStoreKitBridge.a"
done

lipo -create "$output/arm64/libStoreKitBridge.a" "$output/x86_64/libStoreKitBridge.a" \
  -output "$output/libStoreKitBridge.a"
