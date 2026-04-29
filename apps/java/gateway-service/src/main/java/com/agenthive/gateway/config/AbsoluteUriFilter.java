package com.agenthive.gateway.config;

import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * Workaround for Spring Framework 6.1.x issue where {@code CorsUtils.isSameOrigin()}
 * asserts that {@code ServerHttpRequest.getURI()} is absolute. In WebFlux tests with
 * {@code WebTestClient}, Netty sends relative URIs in the HTTP request line, causing
 * {@code getURI()} to return a relative URI (null scheme/host, -1 port). This triggers
 * an {@code IllegalArgumentException} in CORS processing, resulting in 403 Forbidden
 * even for allowed origins.
 *
 * <p>This filter reconstructs an absolute URI from the connection's local address
 * when the original URI is relative, wrapping the request before CORS filters run.
 * In production behind a reverse proxy, this filter is typically a no-op because
 * {@code ForwardedHeaderTransformer} or the proxy itself ensures absolute URIs.
 */
@Component
public class AbsoluteUriFilter implements WebFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        URI uri = request.getURI();

        if (uri.getScheme() == null || uri.getHost() == null || uri.getPort() == -1) {
            ServerHttpRequest mutatedRequest = new AbsoluteUriServerHttpRequest(request);
            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    /**
     * Decorator that overrides {@code getURI()} to return an absolute URI
     * reconstructed from the delegate's local address and path.
     */
    private static class AbsoluteUriServerHttpRequest extends ServerHttpRequestDecorator {

        private final URI absoluteUri;

        AbsoluteUriServerHttpRequest(ServerHttpRequest delegate) {
            super(delegate);
            this.absoluteUri = buildAbsoluteUri(delegate);
        }

        private static URI buildAbsoluteUri(ServerHttpRequest request) {
            URI uri = request.getURI();
            try {
                InetSocketAddress localAddress = request.getLocalAddress();
                String scheme = request.getSslInfo() != null ? "https" : "http";
                String host = localAddress != null ? localAddress.getHostString() : "localhost";
                int port = localAddress != null ? localAddress.getPort() : 80;
                String path = uri.getPath() != null ? uri.getPath() : "/";
                String query = uri.getQuery();

                return new URI(scheme, null, host, port, path, query, null);
            } catch (URISyntaxException e) {
                throw new IllegalStateException(
                        "Failed to build absolute URI from: " + uri, e);
            }
        }

        @Override
        public URI getURI() {
            return absoluteUri;
        }
    }
}
