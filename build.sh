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
if [ -f "../clients/python/marie/marie_core.py" ]; then
    mv ../clients/python/marie/marie_core.py ../clients/python/marie/core.py
fi

# Explicitly copy the shared library from Rust's target directory to the Python package
# On Linux this is .so, on macOS .dylib, on Windows .dll
if [ -f "./target/release/libmarie_core.so" ]; then
    cp ./target/release/libmarie_core.so ../clients/python/marie/libmarie_core.so
elif [ -f "./target/release/libmarie_core.dylib" ]; then
    cp ./target/release/libmarie_core.dylib ../clients/python/marie/libmarie_core.so
elif [ -f "./target/release/marie_core.dll" ]; then
    cp ./target/release/marie_core.dll ../clients/python/marie/libmarie_core.so
fi

echo "✅ Done! Modular refactor complete."
echo "   New import: from marie.agent import MarieAgent"
