---
name: io-performance
description: High-performance file I/O patterns and optimization techniques. Use when dealing with large files, batch processing, streaming data, or optimizing file read/write operations. Provides language-specific patterns for Python, Node.js, and general I/O optimization strategies. Triggers on: "fast file read", "optimize I/O", "large file processing", "streaming", "file performance".
---

# High-Performance File I/O

Optimize file read/write operations with proven patterns for speed and memory efficiency.

## Quick Decision Guide

| Scenario | Recommended Approach |
|----------|---------------------|
| Small files (< 10MB) | Buffered read/write |
| Large files (> 100MB) | Streaming/chunked processing |
| Random access | Memory mapping (mmap) |
| JSON/CSV parsing | Specialized libraries (orjson, PapaParse) |
| Binary data | ArrayBuffer/Buffer with streams |
| Concurrent operations | Async I/O with semaphore limiting |

---

## Python Patterns

### 1. Basic Buffered I/O

```python
from pathlib import Path
import io

# Fast: Use buffering for large files
def fast_read_buffered(path: Path, buffer_size: int = 1024 * 1024) -> str:
    """Read file with custom buffer size (default 1MB)."""
    with open(path, 'r', buffering=buffer_size) as f:
        return f.read()

# Fast: Read in chunks for very large files
def read_chunks(path: Path, chunk_size: int = 8192):
    """Generator that yields file chunks."""
    with open(path, 'rb') as f:
        while chunk := f.read(chunk_size):
            yield chunk
```

### 2. Memory Mapping (Best for Large Files)

```python
import mmap

def fast_read_mmap(path: Path) -> bytes:
    """Memory-efficient read using mmap."""
    with open(path, 'rb') as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            return bytes(mm)

def process_large_file_mmap(path: Path, callback):
    """Process large file line by line without loading into RAM."""
    with open(path, 'rb') as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for line in iter(mm.readline, b''):
                callback(line.decode('utf-8'))
```

### 3. JSON Optimization

```python
import orjson  # pip install orjson - 10x faster than json
import json
from pathlib import Path

def fast_load_json(path: Path) -> dict:
    """Fast JSON loading with orjson."""
    data = path.read_bytes()
    return orjson.loads(data)

def fast_dump_json(data: dict, path: Path) -> None:
    """Fast JSON writing with orjson."""
    path.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))

# Streaming JSON for large arrays
def stream_json_array(path: Path):
    """Stream large JSON array without loading all into memory."""
    import ijson  # pip install ijson
    with open(path, 'rb') as f:
        for item in ijson.items(f, 'item'):
            yield item
```

### 4. CSV Optimization

```python
import csv
import pandas as pd

def fast_read_csv(path: Path, chunksize: int = 10000):
    """Read CSV in chunks to control memory usage."""
    for chunk in pd.read_csv(path, chunksize=chunksize):
        yield chunk

def fast_write_csv(rows: list[dict], path: Path, buffer_size: int = 1024*1024):
    """Write CSV with buffering."""
    with open(path, 'w', newline='', buffering=buffer_size) as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
```

### 5. Concurrent File Operations

```python
import asyncio
import aiofiles  # pip install aiofiles
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from functools import partial

# Async file I/O
async def async_read_file(path: Path) -> str:
    """Non-blocking file read."""
    async with aiofiles.open(path, 'r') as f:
        return await f.read()

async def async_write_file(path: Path, content: str) -> None:
    """Non-blocking file write."""
    async with aiofiles.open(path, 'w') as f:
        await f.write(content)

# Thread pool for parallel I/O
def parallel_process_files(file_paths: list[Path], process_fn, max_workers: int = 4):
    """Process multiple files in parallel."""
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = executor.map(process_fn, file_paths)
        return list(results)

# Semaphore to limit concurrent I/O
async def limited_concurrent_reads(file_paths: list[Path], max_concurrent: int = 5):
    """Read files concurrently with rate limiting."""
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def read_with_limit(path):
        async with semaphore:
            return await async_read_file(path)
    
    return await asyncio.gather(*[read_with_limit(p) for p in file_paths])
```

### 6. Binary I/O Optimization

```python
import struct
import array

def fast_read_binary_array(path: Path) -> array.array:
    """Read binary numbers efficiently."""
    arr = array.array('f')  # 'f' for float, 'i' for int
    with open(path, 'rb') as f:
        arr.fromfile(f, path.stat().st_size // arr.itemsize)
    return arr

def read_structured_binary(path: Path, fmt: str = 'I f f'):
    """Read structured binary data."""
    # fmt: struct format string, e.g., 'I f f' = uint32, float, float
    struct_size = struct.calcsize(fmt)
    with open(path, 'rb') as f:
        while chunk := f.read(struct_size):
            yield struct.unpack(fmt, chunk)
```

---

## Node.js / JavaScript Patterns

### 1. Streaming I/O

```javascript
const fs = require('fs');
const readline = require('readline');
const { pipeline } = require('stream/promises');

// Fast: Stream large files line by line
async function* readLinesStream(filePath) {
  const fileStream = fs.createReadStream(filePath, { 
    highWaterMark: 64 * 1024  // 64KB buffer
  });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    yield line;
  }
}

// Process line by line without loading entire file
async function processLargeFile(filePath, processFn) {
  for await (const line of readLinesStream(filePath)) {
    await processFn(line);
  }
}

// Pipeline for transform streams
async function transformFile(inputPath, outputPath, transformFn) {
  await pipeline(
    fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 }),
    transformFn,
    fs.createWriteStream(outputPath)
  );
}
```

### 2. Fast JSON Processing

```javascript
// For large JSON: Use stream-json
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

function streamJsonArray(filePath, onItem) {
  return new Promise((resolve, reject) => {
    const pipeline = fs.createReadStream(filePath)
      .pipe(parser())
      .pipe(streamArray());
    
    pipeline.on('data', onItem);
    pipeline.on('end', resolve);
    pipeline.on('error', reject);
  });
}

// Fast JSON serialization for large objects
function fastStringify(obj) {
  // For truly massive data, consider:
  // - JSONStream for streaming stringify
  // - fast-json-stringify for schema-based serialization
  return JSON.stringify(obj);
}
```

### 3. Async File Operations

```javascript
const fsPromises = require('fs').promises;
const { Readable, Transform } = require('stream');

// Fast: Async I/O without blocking event loop
async function fastReadFile(filePath) {
  return fsPromises.readFile(filePath);
}

async function fastWriteFile(filePath, data) {
  return fsPromises.writeFile(filePath, data);
}

// Batch write with buffering
class BufferedWriter {
  constructor(filePath, bufferSize = 1024 * 1024) {
    this.filePath = filePath;
    this.buffer = [];
    this.bufferSize = bufferSize;
    this.currentSize = 0;
    this.stream = fs.createWriteStream(filePath);
  }

  write(data) {
    this.buffer.push(data);
    this.currentSize += Buffer.byteLength(data);
    
    if (this.currentSize >= this.bufferSize) {
      return this.flush();
    }
    return Promise.resolve();
  }

  async flush() {
    if (this.buffer.length === 0) return;
    
    const chunk = this.buffer.join('');
    this.buffer = [];
    this.currentSize = 0;
    
    return new Promise((resolve, reject) => {
      this.stream.write(chunk, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close() {
    await this.flush();
    return new Promise((resolve) => this.stream.end(resolve));
  }
}
```

### 4. Worker Threads for CPU-Intensive I/O

```javascript
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');

// Parallel file processing with worker threads
function processFilesParallel(filePaths, workerScript) {
  return Promise.all(
    filePaths.map(filePath => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(workerScript, {
          workerData: { filePath }
        });
        worker.on('message', resolve);
        worker.on('error', reject);
      });
    })
  );
}
```

---

## Universal Best Practices

### 1. Buffer Size Guidelines

| File Size | Recommended Buffer |
|-----------|-------------------|
| < 1 MB | Default (8KB) |
| 1-100 MB | 64KB - 256KB |
| > 100 MB | 1MB+ or streaming |

### 2. I/O Patterns Comparison

```
+------------------------------------------------------------------+
| Pattern           Speed       Memory      Use Case               |
+------------------------------------------------------------------+
| Read all          ***         *           Small files            |
| Buffered          **          **          Medium files           |
| Streaming         **          *****       Large files            |
| Memory mapping    ****        ****        Random access          |
| Async I/O         *****       ***         Concurrent             |
+------------------------------------------------------------------+
```

### 3. Error Handling Template

```python
# Python robust I/O
def safe_read_file(path: Path, max_retries: int = 3) -> bytes:
    """Read file with retry logic."""
    import time
    for attempt in range(max_retries):
        try:
            return path.read_bytes()
        except (IOError, OSError) as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(0.1 * (attempt + 1))  # Exponential backoff
    return b''
```

```javascript
// JavaScript robust I/O
async function safeReadFile(filePath, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fsPromises.readFile(filePath);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    }
  }
}
```

### 4. File Locking (Prevent Concurrent Write Issues)

```python
# Python: filelock library
from filelock import FileLock

def safe_write_with_lock(path: Path, data: bytes) -> None:
    lock_path = path.with_suffix('.lock')
    with FileLock(lock_path):
        path.write_bytes(data)
```

```javascript
// Node.js: proper-stream library or native flock
const lockfile = require('proper-lockfile');

async function safeWriteWithLock(filePath, data) {
  const release = await lockfile.lock(filePath);
  try {
    await fsPromises.writeFile(filePath, data);
  } finally {
    await release();
  }
}
```

---

## Performance Checklist

- [ ] **Use appropriate buffer sizes** - Don't use defaults for all cases
- [ ] **Stream large files** - Never load >100MB files entirely into RAM
- [ ] **Use specialized libraries** - orjson > json, fast-csv > csv
- [ ] **Enable async/concurrent I/O** - Don't block on single file operations
- [ ] **Memory map for random access** - Fast seeking in large binary files
- [ ] **Batch small writes** - Reduce system call overhead
- [ ] **Handle errors gracefully** - Retry with exponential backoff
- [ ] **Use file locking** - Prevent corruption in concurrent scenarios

---

## Recommended Libraries

| Language | Library | Purpose | Speed Gain |
|----------|---------|---------|------------|
| Python | orjson | JSON parsing | 10-100x |
| Python | aiofiles | Async I/O | Non-blocking |
| Python | pyarrow | Columnar data | 5-10x |
| Python | pandas (chunks) | CSV processing | Memory efficient |
| Node.js | stream-json | JSON streaming | Memory efficient |
| Node.js | fast-json-stringify | JSON serialize | 10x |
| Node.js | piscina | Worker pool | Parallel processing |
