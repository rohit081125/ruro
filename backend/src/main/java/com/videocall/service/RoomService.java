package com.videocall.service;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class RoomService {
    private final Set<String> activeRooms = new HashSet<>();

    public String createRoom() {
        String code = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        activeRooms.add(code);
        return code;
    }

    public boolean roomExists(String code) {
        return activeRooms.contains(code.toUpperCase());
    }
}