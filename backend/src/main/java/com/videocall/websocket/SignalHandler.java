package com.videocall.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;

@Component
public class SignalHandler extends TextWebSocketHandler {

    private static final Map<String, List<WebSocketSession>> rooms =
            new HashMap<>();

    @Override
    public void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws Exception {

        String payload = message.getPayload();

        // JOIN ROOM
        if (payload.startsWith("JOIN:")) {

            String roomCode =
                    payload.substring(5);

            rooms.putIfAbsent(
                    roomCode,
                    new ArrayList<>()
            );

            List<WebSocketSession> users =
                    rooms.get(roomCode);

            // LIMIT ONLY 2 USERS
            if (users.size() >= 2) {

                session.sendMessage(
                        new TextMessage("ROOM_FULL")
                );

                return;
            }

            // FIRST USER
            if (users.isEmpty()) {

                users.add(session);

                session.getAttributes().put(
                        "room",
                        roomCode
                );

                session.sendMessage(
                        new TextMessage("EXISTING_USER")
                );

                return;
            }

            // SECOND USER
            users.add(session);

            session.getAttributes().put(
                    "room",
                    roomCode
            );

            // NOTIFY FIRST USER
            for (WebSocketSession user : users) {

                if (
                        user.isOpen() &&
                        !user.getId().equals(session.getId())
                ) {

                    user.sendMessage(
                            new TextMessage("NEW_USER_JOINED")
                    );
                }
            }

            return;
        }

        // SIGNALING
        String[] parts =
                payload.split("::", 2);

        if (parts.length < 2) return;

        String roomCode = parts[0];

        String signal = parts[1];

        List<WebSocketSession> users =
                rooms.get(roomCode);

        if (users == null) return;

        // FORWARD TO OTHER USER
        for (WebSocketSession user : users) {

            if (
                    user.isOpen() &&
                    !user.getId().equals(session.getId())
            ) {

                user.sendMessage(
                        new TextMessage(signal)
                );
            }
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status
    ) throws Exception {

        String roomCode =
                (String) session
                        .getAttributes()
                        .get("room");

        if (roomCode == null) return;

        List<WebSocketSession> users =
                rooms.get(roomCode);

        if (users == null) return;

        users.remove(session);

        // NOTIFY OTHER USER
        for (WebSocketSession user : users) {

            if (user.isOpen()) {

                user.sendMessage(
                        new TextMessage(
                                "{\"type\":\"user-left\"}"
                        )
                );
            }
        }

        // REMOVE EMPTY ROOM
        if (users.isEmpty()) {
            rooms.remove(roomCode);
        }
    }
}