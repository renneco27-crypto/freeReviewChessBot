# pySlick Diagnostics Toolkit

Tools for catching missing brackets, mismatched JSX tags, scope drifts, and Babel/React syntax errors.

## Tools Included

### 1. `indentation.py`
Analyzes scope indentation and brace (`{` / `}`) nesting balance in source files.
```bash
python indentation.py <path_to_file>
```

### 2. `jsx_tag_checker.py`
Scans HTML and JSX files for mismatched closing tags (`<div>...</span>`), unclosed containers, missing closing tags, and unclosed React fragments (`<>...</>`).
```bash
python jsx_tag_checker.py <path_to_html_or_jsx_file>
```

### 3. `babel_syntax_validator.js`
Uses `@babel/standalone` to parse and validate inline `<script type="text/babel">` blocks inside HTML pages or standalone JSX/JS files. Pinpoints the exact line, column, and code context for syntax errors like `Unexpected token }`.
```bash
node babel_syntax_validator.js <path_to_file>
```
