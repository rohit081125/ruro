package com.videocall.controller;

import com.videocall.service.RoomService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/create")
    public Map<String, String> createRoom() {
        String code = roomService.createRoom();
        return Map.of("roomCode", code);
    }

    @GetMapping("/check/{code}")
    public Map<String, Boolean> checkRoom(@PathVariable String code) {
        return Map.of("exists", roomService.roomExists(code));
    }
}