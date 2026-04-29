#!/usr/bin/env python3
"""
Config Consistency Check: docker-compose.dev.yml ↔ application.yml alignment

TICKET: TICKET-PLAT-DEV-006

Scans docker-compose.dev.yml and all application configs to detect:
  - Unused injection: env var injected by docker-compose but not consumed by app
  - Missing injection: env var consumed by app but not injected by docker-compose
  - .env.dev.example coverage gaps for required variables

Exit codes:
  0 = all aligned
  1 = warnings only (unused variables)
  2 = errors (missing required variables or .env.dev.example gaps)
"""

import io
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

# Fix Windows console encoding for UTF-8 output
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# Regex to match ${VAR}, ${VAR:-default}, and ${VAR:default} in YAML / shell strings
# Supports both shell syntax ${VAR:-default} and Spring placeholder ${VAR:default}
ENV_REF_PATTERN = re.compile(r'\$\{([A-Z_][A-Z0-9_]*)(?::(-?[^}]*))?\}')

# Regex to match process.env.XXX in JS/TS
PROCESS_ENV_PATTERN = re.compile(r'process\.env\.([A-Z_][A-Z0-9_]*)')

# Known service → application config mapping
SERVICE_APP_MAP = {
    'api': {
        'type': 'node',
        'paths': ['apps/api/src'],
        'exts': {'.ts', '.js', '.mjs'},
    },
    'landing': {
        'type': 'node',
        'paths': ['apps/landing'],
        'exts': {'.ts', '.js', '.vue'},
        'exclude_dirs': {'.nuxt', 'dist', '.output', 'node_modules', '.pnpm'},
    },
    'gateway-service': {
        'type': 'java',
        'paths': ['apps/java/gateway-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'auth-service': {
        'type': 'java',
        'paths': ['apps/java/auth-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'user-service': {
        'type': 'java',
        'paths': ['apps/java/user-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'payment-service': {
        'type': 'java',
        'paths': ['apps/java/payment-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'order-service': {
        'type': 'java',
        'paths': ['apps/java/order-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'cart-service': {
        'type': 'java',
        'paths': ['apps/java/cart-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
    'logistics-service': {
        'type': 'java',
        'paths': ['apps/java/logistics-service/src/main/resources'],
        'files': ['application-docker.yml', 'bootstrap.yml'],
    },
}

# Services that have no application config (infrastructure only)
INFRA_SERVICES = {
    'postgres', 'redis', 'nacos', 'rabbitmq',
    'prometheus', 'grafana', 'tempo', 'loki', 'otel-collector', 'nginx',
}


def extract_env_refs(text):
    """
    Extract ${VAR} references from text.
    Returns dict: {var_name: {'has_default': bool, 'default': str|None}}
    """
    refs = {}
    for match in ENV_REF_PATTERN.finditer(text):
        var_name = match.group(1)
        default_val = match.group(2)
        # Strip leading '-' from shell-style defaults for uniform handling
        if default_val is not None and default_val.startswith('-'):
            default_val = default_val[1:]
        has_default = default_val is not None and default_val.strip() != ''
        if var_name not in refs:
            refs[var_name] = {'has_default': has_default, 'default': default_val}
        else:
            # If any occurrence has no default, mark as required
            if not has_default:
                refs[var_name]['has_default'] = False
                refs[var_name]['default'] = None
    return refs


def parse_docker_compose(filepath):
    """
    Parse docker-compose YAML and return per-service info:
      {service_name: {'injected': {var_name: {...}}, 'host_refs': {var_name: {...}}}}
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Remove BOM
    if lines and lines[0].startswith('\ufeff'):
        lines[0] = lines[0][1:]

    services = {}
    in_services = False
    current_service = None
    current_section = None
    section_indent = 0

    for line in lines:
        stripped = line.lstrip()
        if not stripped or stripped.startswith('#'):
            continue

        indent = len(line) - len(line.lstrip())

        if stripped == 'services:' or stripped.startswith('services:'):
            in_services = True
            continue

        if in_services and indent == 0 and (
            stripped.startswith('volumes:') or
            stripped.startswith('networks:') or
            stripped.startswith('version:')
        ):
            in_services = False
            current_service = None
            continue

        if in_services:
            # Service name line: indent == 2
            if indent == 2 and re.match(r'^[a-zA-Z0-9_-]+:\s*$', stripped):
                current_service = stripped.split(':')[0].strip()
                services[current_service] = {
                    'injected': {},   # env vars injected into container (keys in environment: section)
                    'host_refs': {},  # all ${VAR} refs in the service block (for .env.dev.example check)
                }
                current_section = None
                section_indent = 0
                continue

            if current_service is None:
                continue

            # Detect section start within a service
            if indent == 4:
                section_key = stripped.split(':')[0].strip()
                current_section = section_key
                section_indent = indent
                continue

            # Handle environment section
            if current_section == 'environment':
                if indent >= 6:
                    # Key-value format:    DB_HOST: postgres
                    if ':' in stripped:
                        key, val = stripped.split(':', 1)
                        key = key.strip()
                        val = val.strip()
                        # Store injected variable
                        services[current_service]['injected'][key] = {'raw_value': val}
                        # Also extract ${VAR} refs from the value
                        refs = extract_env_refs(val)
                        for var_name, info in refs.items():
                            if var_name not in services[current_service]['host_refs']:
                                services[current_service]['host_refs'][var_name] = info
                            else:
                                if not info['has_default']:
                                    services[current_service]['host_refs'][var_name]['has_default'] = False
                    else:
                        # List format: - DB_HOST=postgres
                        m = re.match(r'^-\s*(\w+)=(.*)$', stripped)
                        if m:
                            key = m.group(1).strip()
                            val = m.group(2).strip()
                            services[current_service]['injected'][key] = {'raw_value': val}
                            refs = extract_env_refs(val)
                            for var_name, info in refs.items():
                                if var_name not in services[current_service]['host_refs']:
                                    services[current_service]['host_refs'][var_name] = info
                                else:
                                    if not info['has_default']:
                                        services[current_service]['host_refs'][var_name]['has_default'] = False
                continue

            # For non-environment sections, still collect ${VAR} refs for .env.dev.example check
            if current_section and current_section != 'environment' and indent >= 6:
                refs = extract_env_refs(stripped)
                for var_name, info in refs.items():
                    if var_name not in services[current_service]['host_refs']:
                        services[current_service]['host_refs'][var_name] = info
                    else:
                        if not info['has_default']:
                            services[current_service]['host_refs'][var_name]['has_default'] = False
                continue

            # If we drop back to indent <= section_indent, clear section
            if indent <= section_indent:
                current_section = None

    return services


def parse_yaml_file(filepath):
    """
    Parse a YAML file and extract all ${VAR} references from values.
    Returns dict: {var_name: {'has_default': bool, 'default': str|None}}
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Remove BOM
    if text.startswith('\ufeff'):
        text = text[1:]

    return extract_env_refs(text)


# Node env vars that are automatically provided or don't need docker-compose injection
NODE_BUILTIN_VARS = {
    'npm_package_version', 'HOSTNAME',
}

# Variables consumed directly by runtime / framework, not by application config files
# These are intentionally injected even if not referenced in application.yml/bootstrap.yml
KNOWN_RUNTIME_VARS = {
    # JVM / Spring Boot direct property overrides
    'JAVA_OPTS',
    'SPRING_PROFILES_ACTIVE',
    'SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING',
    # Node.js / OpenTelemetry runtime
    'UV_THREADPOOL_SIZE',
    'OTEL_SDK_DISABLED',
}


def scan_node_source(paths, exts, exclude_dirs=None):
    """
    Scan JS/TS source files for process.env.XXX references.
    Returns dict: {var_name: {'has_default': bool, 'locations': [(file, line)]}}
    has_default is True if we detect '||' or '?' after the reference on the same line,
    or if the variable is used inside an if-condition or comparison.
    """
    if exclude_dirs is None:
        exclude_dirs = {'node_modules', 'dist', '.output', '.nuxt', '.pnpm', '.ignored'}

    consumed = defaultdict(lambda: {'has_default': True, 'locations': []})

    for base_path in paths:
        base = Path(base_path)
        if not base.exists():
            continue
        for ext in exts:
            for filepath in base.rglob(f'*{ext}'):
                # Skip generated/dependency directories
                if any(part in exclude_dirs for part in filepath.parts):
                    continue
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                except (UnicodeDecodeError, PermissionError):
                    continue

                for line_num, line in enumerate(lines, 1):
                    for match in PROCESS_ENV_PATTERN.finditer(line):
                        var_name = match.group(1)
                        if var_name in NODE_BUILTIN_VARS:
                            continue

                        after = line[match.end():]
                        # Heuristic: explicit fallback operators
                        has_default = '||' in after or '?.' in after or '?=' in after

                        # Heuristic: used in comparison or condition → optional
                        if not has_default:
                            if re.search(r'[=!]==?', after) or re.search(r'if\s*\(', line):
                                has_default = True
                            # Check for common optional patterns like typeof process.env.X !== 'undefined'
                            if 'undefined' in line or 'null' in line:
                                has_default = True

                        if not has_default:
                            consumed[var_name]['has_default'] = False

                        consumed[var_name]['locations'].append((str(filepath), line_num))

    return dict(consumed)


def parse_env_example(filepath):
    """
    Parse .env.dev.example and return set of defined variable names.
    """
    defined = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            m = re.match(r'^([A-Z_][A-Z0-9_]*)\s*=', stripped)
            if m:
                defined.add(m.group(1))
    return defined


def main():
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)

    docker_compose_path = 'docker-compose.dev.yml'
    env_example_path = '.env.dev.example'

    if not Path(docker_compose_path).exists():
        print(f"ERROR: {docker_compose_path} not found")
        sys.exit(2)

    # ------------------------------------------------------------------
    # 1. Parse docker-compose
    # ------------------------------------------------------------------
    dc_services = parse_docker_compose(docker_compose_path)

    # ------------------------------------------------------------------
    # 2. Parse application configs
    # ------------------------------------------------------------------
    app_consumed = {}  # service_name -> {var_name: info}

    for service_name, mapping in SERVICE_APP_MAP.items():
        if mapping['type'] == 'java':
            consumed = {}
            for base_path in mapping['paths']:
                for filename in mapping.get('files', []):
                    fp = Path(base_path) / filename
                    if fp.exists():
                        refs = parse_yaml_file(str(fp))
                        for var_name, info in refs.items():
                            if var_name not in consumed:
                                consumed[var_name] = info
                            else:
                                if not info['has_default']:
                                    consumed[var_name]['has_default'] = False
            app_consumed[service_name] = consumed
        elif mapping['type'] == 'node':
            app_consumed[service_name] = scan_node_source(
                mapping['paths'],
                mapping.get('exts', {'.ts', '.js'}),
                exclude_dirs=mapping.get('exclude_dirs')
            )

    # ------------------------------------------------------------------
    # 3. Parse .env.dev.example
    # ------------------------------------------------------------------
    env_example_vars = parse_env_example(env_example_path)

    # ------------------------------------------------------------------
    # 4. Analysis & Reporting
    # ------------------------------------------------------------------
    warnings = []
    errors = []
    report_lines = []
    report_lines.append("=" * 70)
    report_lines.append("CONFIG CONSISTENCY REPORT")
    report_lines.append("docker-compose.dev.yml  ↔  application configs  ↔  .env.dev.example")
    report_lines.append("=" * 70)
    report_lines.append("")

    # Services with app configs
    for service_name in sorted(SERVICE_APP_MAP.keys()):
        dc_injected = set(dc_services.get(service_name, {}).get('injected', {}).keys())
        dc_host_refs = dc_services.get(service_name, {}).get('host_refs', {})
        consumed = app_consumed.get(service_name, {})
        consumed_vars = set(consumed.keys())

        report_lines.append(f"Service: {service_name}")
        report_lines.append(f"  Injected by docker-compose: {sorted(dc_injected) or '(none)'}")
        report_lines.append(f"  Consumed by application:    {sorted(consumed_vars) or '(none)'}")

        # Unused: injected but not consumed
        unused = sorted(dc_injected - consumed_vars - KNOWN_RUNTIME_VARS)
        if unused:
            report_lines.append(f"  ⚠ UNUSED injection (in docker-compose but not consumed):")
            for var in unused:
                report_lines.append(f"      - {var}")
            warnings.append(f"{service_name}: unused {unused}")

        # Runtime-only variables (consumed by runtime/framework, not app config)
        runtime_only = sorted((dc_injected - consumed_vars) & KNOWN_RUNTIME_VARS)
        if runtime_only:
            report_lines.append(f"  ℹ RUNTIME injection (consumed by runtime/framework directly):")
            for var in runtime_only:
                report_lines.append(f"      - {var}")

        # Missing: consumed but not injected
        missing = sorted(consumed_vars - dc_injected)
        missing_required = []
        missing_optional = []
        for var in missing:
            info = consumed.get(var, {})
            if info.get('has_default'):
                missing_optional.append(var)
            else:
                missing_required.append(var)

        if missing_required:
            report_lines.append(f"  ✗ MISSING required injection (consumed, no default in app):")
            for var in missing_required:
                report_lines.append(f"      - {var}")
            errors.append(f"{service_name}: missing required {missing_required}")

        if missing_optional:
            report_lines.append(f"  ○ MISSING optional injection (consumed, but has default in app):")
            for var in missing_optional:
                report_lines.append(f"      - {var}")

        if not unused and not missing:
            report_lines.append("  Mismatches: NONE ✓")
        report_lines.append("")

    # Infrastructure services (no app config, just check .env.dev.example)
    report_lines.append("-" * 70)
    report_lines.append("INFRASTRUCTURE SERVICES (no application config)")
    report_lines.append("-" * 70)
    report_lines.append("")

    for service_name in sorted(INFRA_SERVICES):
        if service_name not in dc_services:
            continue
        host_refs = dc_services[service_name].get('host_refs', {})
        required = [v for v, info in host_refs.items() if not info.get('has_default')]
        optional = [v for v, info in host_refs.items() if info.get('has_default')]

        report_lines.append(f"Service: {service_name}")
        if required:
            report_lines.append(f"  Required host variables: {sorted(required)}")
        if optional:
            report_lines.append(f"  Optional host variables: {sorted(optional)}")
        if not required and not optional:
            report_lines.append("  No host env references")
        report_lines.append("")

    # ------------------------------------------------------------------
    # 5. .env.dev.example coverage check
    # ------------------------------------------------------------------
    report_lines.append("-" * 70)
    report_lines.append(".env.dev.example COVERAGE CHECK")
    report_lines.append("-" * 70)
    report_lines.append("")

    all_required = set()
    for service_name, info in dc_services.items():
        for var_name, var_info in info.get('host_refs', {}).items():
            if not var_info.get('has_default'):
                all_required.add(var_name)

    # Also consider consumed vars without defaults as required
    for service_name, consumed in app_consumed.items():
        dc_injected = set(dc_services.get(service_name, {}).get('injected', {}).keys())
        for var_name, info in consumed.items():
            if not info.get('has_default') and var_name not in dc_injected:
                all_required.add(var_name)

    missing_in_example = sorted(all_required - env_example_vars)
    present_in_example = sorted(all_required & env_example_vars)

    report_lines.append(f"Required variables covered: {len(present_in_example)}")
    report_lines.append(f"Required variables missing: {len(missing_in_example)}")
    report_lines.append("")

    if present_in_example:
        report_lines.append("Covered in .env.dev.example:")
        for var in present_in_example:
            report_lines.append(f"  ✓ {var}")
        report_lines.append("")

    if missing_in_example:
        report_lines.append("MISSING from .env.dev.example:")
        for var in missing_in_example:
            report_lines.append(f"  ✗ {var}")
        errors.append(f".env.dev.example missing: {missing_in_example}")
        report_lines.append("")

    # ------------------------------------------------------------------
    # 6. Variable name mismatch detection (heuristic)
    # ------------------------------------------------------------------
    report_lines.append("-" * 70)
    report_lines.append("VARIABLE NAME MISMATCH HEURISTICS")
    report_lines.append("-" * 70)
    report_lines.append("")

    # Look for cases where docker-compose injects a short name but app expects a long Spring name
    mismatch_hints = []
    for service_name in SERVICE_APP_MAP:
        dc_injected = set(dc_services.get(service_name, {}).get('injected', {}).keys())
        consumed = app_consumed.get(service_name, {})
        for var in dc_injected:
            if var not in consumed:
                # Check if any consumed var contains the injected var as suffix/prefix
                for cvar in consumed:
                    if var in cvar and var != cvar:
                        mismatch_hints.append((service_name, var, cvar))
                    elif cvar in var and var != cvar:
                        mismatch_hints.append((service_name, var, cvar))

    if mismatch_hints:
        report_lines.append("Potential name mismatches (injected vs consumed):")
        for svc, inj, cons in mismatch_hints:
            report_lines.append(f"  {svc}: docker-compose injects '{inj}' but app consumes '{cons}'")
        report_lines.append("")
    else:
        report_lines.append("No obvious name mismatches detected.")
        report_lines.append("")

    # ------------------------------------------------------------------
    # 7. Summary & exit
    # ------------------------------------------------------------------
    report_lines.append("=" * 70)
    report_lines.append("SUMMARY")
    report_lines.append("=" * 70)
    report_lines.append(f"Warnings: {len(warnings)}")
    report_lines.append(f"Errors:   {len(errors)}")
    report_lines.append("")

    # Final exit code
    exit_code = 0
    if errors:
        exit_code = 2
    elif warnings:
        exit_code = 1

    report_lines.append(f"Exit code: {exit_code}")
    report = "\n".join(report_lines)
    print(report)

    # Write report to file for CI artifact
    with open('scripts/config-consistency-report.txt', 'w', encoding='utf-8') as f:
        f.write(report)

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
