# TICKET-P0-007 Reflection: Gateway CORS Refactor

## Root Cause
Spring Framework 6.1.15 `CorsUtils.isSameOrigin()` throws `IllegalArgumentException` when `request.getURI()` is relative (WebTestClient default behavior). `DefaultCorsProcessor` catches this and logs "Reject: origin is malformed" → returns 403. This broke CORS integration tests that worked in earlier Spring versions.

## Two CORS Mechanisms in Gateway
1. **RoutePredicateHandlerMapping**: Applies `GlobalCorsProperties` to gateway routes (preflight + actual request headers via DedupeResponseHeader filter)
2. **WebFluxEndpointHandlerMapping**: Handles actuator endpoints (`/actuator/health`), does NOT pick up Gateway's `globalcors` config

Must provide `CorsWebFilter` bean separately to cover actuator endpoints.

## Workaround Implementation
- **AbsoluteUriFilter** (`@Order(Ordered.HIGHEST_PRECEDENCE)`): Wraps relative URIs with `http://localhost{path}` before any CORS processing
- **CorsWebFilterConfig**: Reads from `GlobalCorsProperties` and provides `CorsWebFilter` bean for actuator coverage

## Key Lesson: Preflight Allow-Headers Behavior
Spring CORS preflight response's `Access-Control-Allow-Headers` only includes headers actually requested via `Access-Control-Request-Headers`, NOT all configured `allowedHeaders`. Test assertions must check only the requested subset.

## Test Strategy
- Use `/actuator/health` as test endpoint (local, no downstream dependency)
- Disable Redis health indicator (`management.health.redis.enabled=false`) to avoid 503
- Profile-isolated YMLs (`application-dev.yml`, `application-prod.yml`) for deterministic behavior

## Security Wins
- Removed `allowedHeaders: "*"` + `allowCredentials: true` combo (security scanner alert)
- Explicit origin whitelist per profile (dev: localhost, prod: agenthive.cloud domains)
- No wildcard origins in production

## Skill Candidate
`spring-webflux-cors-dual-mechanism`: Pattern for ensuring CORS covers both gateway routes and actuator endpoints in Spring Cloud Gateway. `relative-uri-cors-bypass`: Ordered.HIGHEST_PRECEDENCE WebFilter decorating relative URIs as absolute before CORS processing.
