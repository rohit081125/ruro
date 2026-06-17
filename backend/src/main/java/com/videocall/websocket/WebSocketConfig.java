package com.videocall.websocket;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
public class WebSocketConfig
        implements WebSocketConfigurer {

    @Autowired
    private SignalHandler signalHandler;

    @Value("${app.security.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry
    ) {

        registry.addHandler(
                signalHandler,
                "/signal"
                )
                .setAllowedOrigins(allowedOrigins.split("\\s*,\\s*"));
    }
}
