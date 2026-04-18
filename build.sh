#!/bin/bash
set -e

echo "🚀 Building Marie Universal Core..."

cd marie-core
cargo build --release

echo "✨ Generating Python Bindings..."
cargo run --bin uniffi-bindgen generate --library ./target/release/libmarie_core.so --language python --out-dir ../clients/python

echo "📦 Copying library to client..."
cp target/release/libmarie_core.so ../clients/python/libmarie_core.so

echo "✅ Done! You can now use the library in Python."
echo "   Run the example: python3 examples/python_usage.py"
