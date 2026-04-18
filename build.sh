#!/bin/bash
set -e

echo "🚀 Building Marie Universal Core..."

cd marie-core
cargo build --release

echo "✨ Generating Python Bindings..."
# Generate into the package directory
cargo run --bin uniffi-bindgen generate --library ./target/release/libmarie_core.so --language python --out-dir ../clients/python/marie

echo "📦 Organizing package structure..."
# Rename marie_core.py to core.py
mv ../clients/python/marie/marie_core.py ../clients/python/marie/core.py

# Move the .so to the package directory if it's in the parent
if [ -f "../clients/python/libmarie_core.so" ]; then
    mv ../clients/python/libmarie_core.so ../clients/python/marie/libmarie_core.so
fi

echo "✅ Done! Modular refactor complete."
echo "   New import: from marie.agent import MarieAgent"
