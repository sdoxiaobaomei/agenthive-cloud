---
name: code-fast-python
description: Rapid Python code generation and modification with best practices. Use when writing new Python code, adding functions/classes, or making quick edits to Python files. Provides snippets for common patterns, type hints, error handling, logging setup, and Pythonic idioms. Triggers on: "write a Python script", "add a function", "create a class", "Python boilerplate", "fast Python".
---

# Fast Python Coding

Accelerate Python development with proven patterns and boilerplate.

## Quick Patterns

### New Python File Template

```python
#!/usr/bin/env python3
"""
[Module description]
"""

import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

# Setup logging
logger = logging.getLogger(__name__)


def main() -> None:
    """Main entry point."""
    pass


if __name__ == "__main__":
    main()
```

### Function with Full Error Handling

```python
def process_data(
    input_path: Path,
    output_path: Optional[Path] = None,
    verbose: bool = False
) -> Dict[str, Any]:
    """
    Process data from input file.
    
    Args:
        input_path: Path to input file
        output_path: Optional output path
        verbose: Enable verbose logging
        
    Returns:
        Dictionary with results
        
    Raises:
        FileNotFoundError: If input file doesn't exist
        ValueError: If data format is invalid
    """
    try:
        if not input_path.exists():
            raise FileNotFoundError(f"Input not found: {input_path}")
        
        # Process logic here
        result = {"status": "success", "count": 0}
        return result
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise
```

### Class with Dataclass

```python
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Config:
    """Configuration container."""
    name: str
    enabled: bool = True
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "enabled": self.enabled,
            "tags": self.tags,
            "created_at": self.created_at.isoformat()
        }
```

### CLI with argparse

```python
import argparse
import sys


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Tool description",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input file path"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=None,
        help="Output file path"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    return parser.parse_args(args)


def main(argv: Optional[List[str]] = None) -> int:
    """Main entry point."""
    args = parse_args(argv)
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    try:
        # Main logic
        return 0
    except Exception as e:
        logger.error(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

### Context Manager

```python
from contextlib import contextmanager


@contextmanager
def managed_resource(path: Path):
    """Context manager for resource handling."""
    resource = None
    try:
        resource = open(path, "r")
        yield resource
    finally:
        if resource:
            resource.close()
```

### Async Pattern

```python
import asyncio
from aiohttp import ClientSession


async def fetch_data(url: str) -> Dict[str, Any]:
    """Fetch data asynchronously."""
    async with ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()


async def main():
    """Main async entry point."""
    tasks = [fetch_data(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results


# Run: asyncio.run(main())
```

## Common Snippets

**Read JSON:**
```python
import json

data = json.loads(path.read_text(encoding="utf-8"))
```

**Write JSON:**
```python
path.write_text(
    json.dumps(data, indent=2, ensure_ascii=False),
    encoding="utf-8"
)
```

**Environment Variables:**
```python
import os

api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("API_KEY environment variable required")
```

**List Comprehension Filter:**
```python
results = [x for x in items if x.is_valid()]
```

**Dictionary Merge:**
```python
merged = {**dict_a, **dict_b}
```

**Group by Key:**
```python
from itertools import groupby

sorted_items = sorted(items, key=lambda x: x.category)
grouped = {
    k: list(v) 
    for k, v in groupby(sorted_items, key=lambda x: x.category)
}
```

## Testing Boilerplate

```python
import pytest
from unittest.mock import Mock, patch, MagicMock


class TestMyClass:
    """Test suite for MyClass."""
    
    @pytest.fixture
    def instance(self):
        return MyClass()
    
    def test_basic_functionality(self, instance):
        """Test basic operation."""
        result = instance.process("input")
        assert result == "expected"
    
    @patch("module.external_call")
    def test_with_mock(self, mock_call, instance):
        """Test with mocked dependency."""
        mock_call.return_value = {"status": "ok"}
        result = instance.process()
        mock_call.assert_called_once()
```

## Performance Tips

- Use `pathlib.Path` over `os.path`
- Prefer generators for large datasets: `(x for x in items)`
- Use `@lru_cache` for expensive function results
- Use `orjson` for faster JSON processing
- Profile with `cProfile` and `snakeviz`
