---
name: code-fast-refactor
description: Fast code refactoring and quality improvement. Use when cleaning up code, improving readability, optimizing performance, or applying best practices. Provides patterns for extracting functions, renaming variables, simplifying conditionals, removing duplication, and improving error handling. Triggers on: "refactor this", "clean up code", "improve this function", "make it cleaner", "optimize", "simplify".
---

# Fast Code Refactoring

Quickly improve code quality with proven refactoring patterns.

## Core Principles

1. **Preserve behavior** - Functionality should remain identical
2. **Small steps** - One change at a time, test after each
3. **Clear intent** - Code should express its purpose clearly
4. **Remove duplication** - DRY (Don't Repeat Yourself)
5. **Single responsibility** - One function/component = one job

## Quick Reference

### Extract Function

**Before:**
```javascript
function processOrder(order) {
  // Validate
  if (!order.items || order.items.length === 0) {
    throw new Error('Empty order');
  }
  if (!order.customer) {
    throw new Error('Missing customer');
  }
  
  // Calculate
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
  }
  
  // Save
  database.save(order);
  
  return { orderId: order.id, total };
}
```

**After:**
```javascript
function processOrder(order) {
  validateOrder(order);
  const total = calculateTotal(order.items);
  saveOrder(order);
  return { orderId: order.id, total };
}

function validateOrder(order) {
  if (!order.items?.length) {
    throw new Error('Empty order');
  }
  if (!order.customer) {
    throw new Error('Missing customer');
  }
}

function calculateTotal(items) {
  return items.reduce((sum, item) => 
    sum + item.price * item.quantity, 0
  );
}
```

### Simplify Conditionals

**Before:**
```python
if user is not None:
    if user.is_active:
        if user.has_permission("admin"):
            show_admin_panel()
        else:
            show_user_panel()
    else:
        show_inactive_message()
else:
    show_login()
```

**After:**
```python
if user is None:
    show_login()
    return

if not user.is_active:
    show_inactive_message()
    return

if user.has_permission("admin"):
    show_admin_panel()
else:
    show_user_panel()
```

### Remove Magic Numbers/Strings

**Before:**
```typescript
if (status === 3) {
  timeout = 86400;
}
```

**After:**
```typescript
const STATUS_COMPLETED = 3;
const ONE_DAY_SECONDS = 86400;

if (status === STATUS_COMPLETED) {
  timeout = ONE_DAY_SECONDS;
}
```

### Replace Loop with Pipeline

**Before:**
```python
results = []
for user in users:
    if user.is_active:
        for order in user.orders:
            if order.total > 100:
                results.append(order)
```

**After:**
```python
results = [
    order for user in users
    if user.is_active
    for order in user.orders
    if order.total > 100
]
```

Or with functions:
```python
from itertools import chain

results = [
    order for order in chain(*(u.orders for u in users if u.is_active))
    if order.total > 100
]
```

### Replace Nested Callbacks

**Before:**
```javascript
fetchUser(id, (err, user) => {
  if (err) { handleError(err); return; }
  fetchOrders(user.id, (err, orders) => {
    if (err) { handleError(err); return; }
    processOrders(orders, (err, result) => {
      if (err) { handleError(err); return; }
      sendResponse(result);
    });
  });
});
```

**After:**
```javascript
try {
  const user = await fetchUser(id);
  const orders = await fetchOrders(user.id);
  const result = await processOrders(orders);
  sendResponse(result);
} catch (err) {
  handleError(err);
}
```

### Consolidate Duplicate Code

**Before:**
```python
def process_pdf(file):
    content = file.read()
    text = extract_pdf_text(content)
    return clean_text(text)

def process_docx(file):
    content = file.read()
    text = extract_docx_text(content)
    return clean_text(text)
```

**After:**
```python
EXTRACTORS = {
    'pdf': extract_pdf_text,
    'docx': extract_docx_text,
}

def process_document(file, file_type):
    content = file.read()
    extract = EXTRACTORS.get(file_type)
    if not extract:
        raise ValueError(f"Unsupported type: {file_type}")
    text = extract(content)
    return clean_text(text)
```

### Improve Naming

**Before:**
```javascript
const d = new Date();
const x = calc(d, items);
```

**After:**
```javascript
const currentDate = new Date();
const totalPrice = calculateOrderTotal(currentDate, orderItems);
```

### Simplify Boolean Expressions

**Before:**
```python
if (is_admin == True and is_active == True) or (is_superuser == True):
    allow_access()
```

**After:**
```python
if (is_admin and is_active) or is_superuser:
    allow_access()
```

### Replace Switch/If-Else Chain

**Before:**
```typescript
function getFormatter(type: string) {
  if (type === 'json') return JSONFormatter;
  if (type === 'xml') return XMLFormatter;
  if (type === 'csv') return CSVFormatter;
  return DefaultFormatter;
}
```

**After:**
```typescript
const FORMATTERS: Record<string, Formatter> = {
  json: JSONFormatter,
  xml: XMLFormatter,
  csv: CSVFormatter,
};

function getFormatter(type: string): Formatter {
  return FORMATTERS[type] ?? DefaultFormatter;
}
```

### Remove Dead Code

**Before:**
```python
def old_function():
    """Not used anymore"""
    pass

x = 10  # Assigned but never used

if True:  # Always true
    do_something()
```

**After:**
```python
do_something()
```

### Error Handling Improvement

**Before:**
```javascript
try {
  const data = JSON.parse(input);
  process(data);
} catch (e) {
  console.log('Error');
}
```

**After:**
```javascript
try {
  const data = JSON.parse(input);
  process(data);
} catch (error) {
  if (error instanceof SyntaxError) {
    logger.error('Invalid JSON format', { input, error: error.message });
    throw new ValidationError('Invalid JSON provided');
  }
  throw error;  // Re-throw unexpected errors
}
```

## Refactoring Checklist

**Before refactoring:**
- [ ] Understand what the code does
- [ ] Check if there are tests
- [ ] Identify the smell/pattern to fix

**During refactoring:**
- [ ] Make small, incremental changes
- [ ] Run tests after each change
- [ ] Commit frequently

**After refactoring:**
- [ ] All tests pass
- [ ] Code is more readable
- [ ] No functionality changed
- [ ] Review for edge cases

## Common Code Smells

| Smell | Fix |
|-------|-----|
| Long function | Extract smaller functions |
| Duplicate code | Extract common function |
| Deep nesting | Early returns, extract functions |
| Magic numbers | Named constants |
| Long parameter list | Parameter object |
| Mutable state | Prefer immutability |
| Comments explaining code | Better naming |
| Feature envy | Move method to appropriate class |

## Performance Refactoring

**Memoization:**
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_calculation(n):
    # ...
```

**Lazy evaluation:**
```python
# List (eager) - all in memory
results = [process(x) for x in items]

# Generator (lazy) - one at a time
results = (process(x) for x in items)
```

**Avoid repeated lookups:**
```javascript
// Before
for (let i = 0; i < array.length; i++) { ... }

// After
for (let i = 0, len = array.length; i < len; i++) { ... }
```
