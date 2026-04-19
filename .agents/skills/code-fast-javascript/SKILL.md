---
name: code-fast-javascript
description: Rapid JavaScript/TypeScript code generation with modern patterns. Use when writing new JS/TS code, adding React components, creating API endpoints, or making quick edits. Provides ES6+ snippets, TypeScript patterns, React hooks, async/await patterns, and Node.js boilerplate. Triggers on: "write JavaScript", "add React component", "TypeScript function", "JS boilerplate", "fast JS".
---

# Fast JavaScript/TypeScript Coding

Accelerate JS/TS development with modern patterns and snippets.

## Quick Patterns

### New Module Template

```typescript
/**
 * [Module description]
 */

// Types
export interface Config {
  name: string;
  enabled?: boolean;
}

// Constants
const DEFAULT_TIMEOUT = 5000;

/**
 * Main function
 */
export async function processData(
  input: Config
): Promise<Result> {
  // Implementation
}
```

### React Component (Functional)

```typescript
import React, { useState, useEffect, useCallback } from 'react';

interface Props {
  title: string;
  onAction?: (id: string) => void;
}

export const MyComponent: React.FC<Props> = ({ 
  title, 
  onAction 
}) => {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(() => {
    onAction?.('id');
  }, [onAction]);

  useEffect(() => {
    // Effect logic
    return () => {
      // Cleanup
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container">
      <h1>{title}</h1>
      <button onClick={handleClick}>Action</button>
    </div>
  );
};
```

### Custom Hook

```typescript
import { useState, useEffect, useRef } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchData = async () => {
    abortController.current?.abort();
    abortController.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url, {
        signal: abortController.current.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => abortController.current?.abort();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}
```

### Express API Route

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

const router = Router();

/**
 * POST /api/items
 * Create new item
 */
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1 }),
    body('email').isEmail().normalizeEmail()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email } = req.body;
      const item = await createItem({ name, email });
      
      res.status(201).json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### Error Handler Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};
```

### Utility Functions

```typescript
// Debounce
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Deep clone
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Safe JSON parse
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
```

### Node.js Script Template

```javascript
#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.error('Usage: node script.js <input>');
      process.exit(1);
    }

    const input = args[0];
    // Process logic
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
```

## Common Snippets

**Array Operations:**
```typescript
// Unique values
const unique = [...new Set(array)];

// Group by
const grouped = array.reduce((acc, item) => {
  (acc[item.key] ||= []).push(item);
  return acc;
}, {} as Record<string, Item[]>);

// Flatten
const flat = arrays.flat();

// Chunk
const chunk = (arr: T[], size: number): T[][] => 
  arr.reduce((acc, _, i) => 
    i % size === 0 ? [...acc, arr.slice(i, i + size)] : acc, 
    [] as T[][]
  );
```

**Async Patterns:**
```typescript
// Parallel with limit
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = await Promise.all(
      tasks.slice(i, i + limit).map(t => t())
    );
    results.push(...batch);
  }
  return results;
}

// Retry with backoff
async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempts <= 1) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, attempts - 1, delay * 2);
  }
}
```

**Type Guards:**
```typescript
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
```

## Testing (Jest)

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should process data correctly', async () => {
    const mockFn = jest.fn().mockResolvedValue({ status: 'ok' });
    service.apiCall = mockFn;

    const result = await service.process();
    
    expect(result).toEqual({ status: 'ok' });
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    jest.spyOn(service, 'apiCall').mockRejectedValue(new Error('Fail'));
    
    await expect(service.process()).rejects.toThrow('Fail');
  });
});
```

## Performance Tips

- Use `const` by default, `let` when needed
- Prefer `async/await` over raw promises
- Use `Map`/`Set` for frequent lookups
- Avoid `any`, use `unknown` when type is truly unknown
- Tree-shake with ES modules
- Use `React.memo` for expensive components
